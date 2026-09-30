// Crea el administrador si no existe (idempotente). Usa ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD.
// Uso: pnpm create-admin
import { RegisterBodySchema } from '@sistema-e/contracts';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/modules/identity/password.js';
import { usersRepository } from '../src/modules/identity/users.repository.js';

const parsed = RegisterBodySchema.safeParse({
  name: process.env.ADMIN_NAME,
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
if (!parsed.success) {
  const problems = parsed.error.issues.map(
    (i) => `ADMIN_${String(i.path[0]).toUpperCase()}: ${i.message}`,
  );
  console.error(`Datos del administrador inválidos:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const { name, email, password } = parsed.data;
const existing = await usersRepository.findByEmail(prisma, email);
if (existing) {
  console.log(`Ya existe ${existing.email} (${existing.role}): no se modifica.`);
} else {
  await usersRepository.create(prisma, {
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'ADMIN',
  });
  console.log(`Administrador creado: ${email}`);
}
await prisma.$disconnect();
