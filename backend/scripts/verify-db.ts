// Verifica estructura, permisos del rol de la API y clasificación de errores. No deja datos.
// Uso: pnpm --filter backend db:verify  |  en app1: sudo bash /vagrant/deploy/app/verify-db.sh
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { pgSslOption, type DbSslMode } from '../src/db/ssl.js';
import { classifyDbError } from '../src/errors/db-errors.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}`);
    process.exit(1);
  }
  return value;
}

// node-postgres usa la opción ssl, no sslmode.
function withoutQuery(url: string): string {
  const parsed = new URL(url);
  parsed.search = '';
  return parsed.toString();
}

const appUrl = requireEnv('DATABASE_URL');
const ownerUrl = withoutQuery(requireEnv('MIGRATE_DATABASE_URL'));
const ssl = pgSslOption((process.env.DB_SSL_MODE ?? 'disable') as DbSslMode);

const lines: string[] = [];
let failures = 0;
const info = (msg: string) => lines.push(`INFO   ${msg}`);
const ok = (msg: string) => lines.push(`OK     ${msg}`);
const fail = (msg: string) => {
  failures += 1;
  lines.push(`FALLA  ${msg}`);
};

function describe(error: unknown): string {
  const e = error as { constructor: { name: string }; code?: string };
  return `${e.constructor.name}${e.code ? ` ${e.code}` : ''}`;
}

// Estructura (owner)
const owner = new pg.Client({ connectionString: ownerUrl, ssl });
await owner.connect();

const migrations = await owner.query<{ migration_name: string }>(
  `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY 1`,
);
info(`migraciones aplicadas: ${migrations.rows.map((r) => r.migration_name).join(', ')}`);

const tables = await owner.query<{ n: string }>(
  `SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
);
const byType = await owner.query<{ contype: string; n: string }>(
  `SELECT contype, count(*) AS n FROM pg_constraint
   WHERE connamespace = 'public'::regnamespace GROUP BY contype ORDER BY contype`,
);
const count = (type: string) => byType.rows.find((r) => r.contype === type)?.n ?? '0';
info(
  `tablas: ${tables.rows[0]?.n} · PK: ${count('p')} · FK: ${count('f')} · UNIQUE: ${count('u')} · CHECK: ${count('c')}`,
);
const indexes = await owner.query<{ n: string }>(
  `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'`,
);
info(`índices: ${indexes.rows[0]?.n}`);

const extensions = await owner.query<{ extname: string }>(
  `SELECT extname FROM pg_extension WHERE extname IN ('citext', 'pg_trgm') ORDER BY 1`,
);
if (extensions.rows.length === 2) ok('extensiones citext y pg_trgm instaladas');
else
  fail(`extensiones encontradas: ${extensions.rows.map((r) => r.extname).join(', ') || 'ninguna'}`);
await owner.end();

// Rol de la API: timeouts y sin DDL
const app = new pg.Client({ connectionString: appUrl, ssl });
await app.connect();

const expectedTimeouts: Record<string, string> = {
  lock_timeout: '5s',
  idle_in_transaction_session_timeout: '10s',
  statement_timeout: '15s',
};
for (const [setting, expected] of Object.entries(expectedTimeouts)) {
  const result = await app.query<Record<string, string>>(`SHOW ${setting}`);
  const value = Object.values(result.rows[0] ?? {})[0];
  if (value === expected) ok(`ecommerce_app ${setting} = ${value}`);
  else fail(`ecommerce_app ${setting} = ${value} (esperado ${expected})`);
}

const ddl: [string, string][] = [
  ['DROP TABLE', 'DROP TABLE products'],
  ['CREATE TABLE', 'CREATE TABLE intruso (id int)'],
  ['TRUNCATE', 'TRUNCATE products'],
  ['ALTER TABLE', 'ALTER TABLE products DROP CONSTRAINT products_stock_non_negative'],
];
for (const [label, sql] of ddl) {
  await app.query('BEGIN');
  try {
    await app.query(sql);
    fail(`ecommerce_app pudo ejecutar ${label}`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '42501') ok(`ecommerce_app no puede ${label} (42501: permiso denegado)`);
    else fail(`${label}: código inesperado ${code}`);
  } finally {
    await app.query('ROLLBACK');
  }
}
await app.end();

// Constraints y clasificación de errores
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: appUrl, ssl }) });

const countRows = () => Promise.all([prisma.user.count(), prisma.category.count()]);
const [usersBefore, categoriesBefore] = await countRows();

async function expectKind(label: string, expected: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    fail(`${label}: no falló`);
  } catch (error) {
    const kind = classifyDbError(error);
    if (kind === expected) ok(`${label} → ${kind} [${describe(error)}]`);
    else fail(`${label} → ${kind ?? 'sin clasificar'}, esperado ${expected} [${describe(error)}]`);
  }
}

await expectKind('stock negativo (CHECK)', 'check', () =>
  prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { name: 'Verificación' } });
    await tx.product.create({
      data: { categoryId: category.id, name: 'Producto', price: '10.00', stock: -1 },
    });
  }),
);

await expectKind('email repetido con otras mayúsculas (citext UNIQUE)', 'unique', () =>
  prisma.$transaction(async (tx) => {
    await tx.user.create({ data: { name: 'A', email: 'Verif@Example.com', passwordHash: 'x' } });
    await tx.user.create({ data: { name: 'B', email: 'verif@example.com', passwordHash: 'x' } });
  }),
);

await expectKind('pedido COMPLETED sin completed_at (CHECK de estado)', 'check', () =>
  prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: 'C', email: 'verif-order@example.com', passwordHash: 'x' },
    });
    await tx.order.create({ data: { userId: user.id, status: 'COMPLETED', total: '5.00' } });
  }),
);

// $executeRaw: pg_sleep y pg_advisory_xact_lock devuelven void.
await expectKind('statement_timeout (SET LOCAL 1s + pg_sleep 2s)', 'unavailable', () =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '1s'`;
    await tx.$executeRaw`SELECT pg_sleep(2)`;
  }),
);

// A retiene el lock; B debe fallar por lock_timeout.
let release!: () => void;
const held = new Promise<void>((resolve) => {
  release = resolve;
});
let acquired!: () => void;
const lockAcquired = new Promise<void>((resolve) => {
  acquired = resolve;
});
const holder = prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    acquired();
    await held;
  },
  { timeout: 15_000 },
);
const holderOutcome = await Promise.race([
  lockAcquired.then(() => 'acquired' as const),
  holder.then(
    () => 'finished' as const,
    (error: unknown) => error,
  ),
]);
if (holderOutcome === 'acquired') {
  const startedAt = Date.now();
  await expectKind('lock_timeout (lock retenido por otra transacción)', 'unavailable', () =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
      },
      { timeout: 15_000 },
    ),
  );
  info(`la segunda transacción esperó ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  release();
  await holder;
} else {
  release();
  fail(
    `lock_timeout: la transacción que retiene el lock no pudo tomarlo [${describe(holderOutcome)}]`,
  );
}

// Sin datos residuales
const [usersAfter, categoriesAfter] = await countRows();
if (usersAfter === usersBefore && categoriesAfter === categoriesBefore) {
  ok('no quedaron datos de prueba');
} else {
  fail(
    `cambiaron los datos: users ${usersBefore}→${usersAfter}, categories ${categoriesBefore}→${categoriesAfter}`,
  );
}
await prisma.$disconnect();

console.log(lines.join('\n'));
console.log(failures === 0 ? '\nResultado: todo OK' : `\nResultado: ${failures} falla(s)`);
process.exit(failures === 0 ? 0 : 1);
