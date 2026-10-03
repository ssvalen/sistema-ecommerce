// Datos de demostración: catálogo de DummyJSON con sus fotos, clientes, pedidos y reseñas.
// Solo corre si no hay productos y necesita salida a internet. Uso: pnpm seed:demo
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { invalidateCatalog } from '../src/cache/catalog-cache.js';
import { redis } from '../src/cache/redis.js';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/modules/identity/password.js';

const CATALOG_URL =
  'https://dummyjson.com/products?limit=0&select=title,description,category,price,stock,images,thumbnail';
const CUSTOMERS = 200;
const ORDERS = 2_000;
const DEMO_PASSWORD = 'demo-cliente-123';
const USD_TO_GTQ = 7.75;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOWNLOAD_CONCURRENCY = 8;
const DOWNLOAD_TIMEOUT_MS = 15_000;

const CATEGORY_NAMES: Record<string, string> = {
  beauty: 'Belleza',
  fragrances: 'Fragancias',
  furniture: 'Muebles',
  groceries: 'Abarrotes',
  'home-decoration': 'Decoración',
  'kitchen-accessories': 'Cocina',
  laptops: 'Laptops',
  'mens-shirts': 'Camisas de hombre',
  'mens-shoes': 'Calzado de hombre',
  'mens-watches': 'Relojes de hombre',
  'mobile-accessories': 'Accesorios para celular',
  motorcycle: 'Motocicletas',
  'skin-care': 'Cuidado de la piel',
  smartphones: 'Celulares',
  'sports-accessories': 'Deportes',
  sunglasses: 'Lentes de sol',
  tablets: 'Tablets',
  tops: 'Blusas',
  vehicle: 'Vehículos',
  'womens-bags': 'Bolsos',
  'womens-dresses': 'Vestidos',
  'womens-jewellery': 'Joyería',
  'womens-shoes': 'Calzado de mujer',
  'womens-watches': 'Relojes de mujer',
};
const FIRST_NAMES = [
  'Ana',
  'Luis',
  'María',
  'Carlos',
  'Sofía',
  'Jorge',
  'Lucía',
  'Diego',
  'Valeria',
  'Andrés',
  'Camila',
  'Fernando',
  'Isabel',
  'Ricardo',
  'Gabriela',
  'Pablo',
  'Daniela',
  'Héctor',
  'Paola',
  'Mario',
];
const LAST_NAMES = [
  'López',
  'García',
  'Pérez',
  'Martínez',
  'Rodríguez',
  'Hernández',
  'González',
  'Ramírez',
  'Morales',
  'Castillo',
  'Ortiz',
  'Reyes',
  'Flores',
  'Mendoza',
  'Cruz',
  'Juárez',
  'Méndez',
  'Aguilar',
  'Herrera',
  'Estrada',
];
// Tres por calificación, de 1 a 5 estrellas.
const REVIEW_COMMENTS = [
  'No cumplió lo que esperaba.',
  'Llegó en mal estado.',
  'No lo recomiendo.',
  'La calidad es menor de lo que muestra la foto.',
  'Funciona, pero tiene detalles.',
  'Esperaba más por el precio.',
  'Cumple, sin más.',
  'Está bien para el precio.',
  'Correcto, aunque podría mejorar.',
  'Buena calidad, lo volvería a comprar.',
  'Muy bueno, llegó rápido.',
  'Buen producto, cumple lo prometido.',
  'Excelente, superó mis expectativas.',
  'Me encantó, totalmente recomendado.',
  'Perfecto, justo lo que buscaba.',
];

const CatalogSchema = z.object({
  products: z.array(
    z.object({
      title: z.string().trim().min(1),
      description: z.string(),
      category: z.string().min(1),
      price: z.number().positive(),
      stock: z.number().int().nonnegative(),
      images: z.array(z.url()),
      thumbnail: z.url(),
    }),
  ),
});
type CatalogItem = z.infer<typeof CatalogSchema>['products'][number];

interface Image {
  contentType: string;
  data: Uint8Array<ArrayBuffer>;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const categoryName = (slug: string) =>
  CATEGORY_NAMES[slug] ?? slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

// Mismas reglas que una imagen subida desde el admin.
async function downloadImage(url: string): Promise<Image | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_BYTES) return null;
    const type = await fileTypeFromBuffer(data);
    return type && IMAGE_TYPES.has(type.mime) ? { contentType: type.mime, data } : null;
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Las ventas se concentran en los primeros ids: mezclar reparte el ranking entre categorías.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

const existing = await prisma.product.count();
if (existing > 0) {
  fail(`La base ya tiene ${existing} productos: seed:demo solo corre sobre un catálogo vacío.`);
}

const startedAt = Date.now();

console.log('Descargando el catálogo de demostración...');
let catalog: CatalogItem[];
try {
  const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  catalog = shuffle(CatalogSchema.parse(await response.json()).products);
} catch (error) {
  fail(
    `No se pudo descargar el catálogo de ${new URL(CATALOG_URL).origin} (${String(error)}). ` +
      'seed:demo necesita salida a internet.',
  );
}

console.log(`Descargando ${catalog.length} imágenes...`);
const images = await mapLimit(catalog, DOWNLOAD_CONCURRENCY, (item) =>
  downloadImage(item.images[0] ?? item.thumbnail),
);

const passwordHash = await hashPassword(DEMO_PASSWORD);

await prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '5min'`;

    const [{ lastOrderId } = { lastOrderId: 0 }] = await tx.$queryRaw<{ lastOrderId: number }[]>`
      SELECT coalesce(max(id), 0)::int AS "lastOrderId" FROM orders`;

    const names = [...new Set(catalog.map((item) => categoryName(item.category)))];
    await tx.category.createMany({
      data: names.map((name) => ({ name, description: 'Categoría de demostración' })),
      skipDuplicates: true,
    });
    const categories = await tx.category.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    const categoryIds = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    for (const [index, item] of catalog.entries()) {
      const image = images[index];
      const categoryId = categoryIds.get(categoryName(item.category).toLowerCase());
      if (categoryId === undefined) throw new Error(`Sin categoría para ${item.category}`);
      await tx.product.create({
        data: {
          categoryId,
          name: item.title.slice(0, 150),
          description: item.description.trim().slice(0, 5000),
          price: Math.max(1, Math.round(item.price * USD_TO_GTQ)).toFixed(2),
          stock: item.stock,
          createdAt: new Date(Date.now() - Math.random() * 365 * 86_400_000),
          image: image
            ? {
                create: {
                  contentType: image.contentType,
                  byteSize: image.data.byteLength,
                  data: image.data,
                },
              }
            : undefined,
        },
        select: { id: true },
      });
    }

    await tx.$executeRaw`
      WITH names AS (SELECT ${FIRST_NAMES}::text[] AS given, ${LAST_NAMES}::text[] AS family)
      INSERT INTO users (name, email, password_hash, role, status, created_at, updated_at)
      SELECT names.given[1 + g % cardinality(names.given)] || ' '
               || names.family[1 + (g / cardinality(names.given)) % cardinality(names.family)],
             'cliente' || lpad(g::text, 4, '0') || '@demo.local',
             ${passwordHash}, 'CUSTOMER', 'ACTIVE',
             now() - random() * interval '365 days', now()
      FROM generate_series(1, ${CUSTOMERS}::int) AS g, names
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`;

    // total = 1 provisorio (CHECK total > 0); se calcula al final desde los ítems.
    await tx.$executeRaw`
      INSERT INTO orders (user_id, status, total, created_at, completed_at)
      SELECT u.ids[1 + floor(random() * cardinality(u.ids))::int], 'COMPLETED', 1,
             x.at, x.at + interval '2 minutes'
      FROM (SELECT now() - random() * interval '365 days' AS at
            FROM generate_series(1, ${ORDERS}::int)) AS x,
           (SELECT array_agg(id) AS ids FROM users WHERE email LIKE '%@demo.local') AS u`;

    // De 1 a 4 ítems por pedido; power(random(), 3) concentra las ventas en pocos productos.
    await tx.$executeRaw`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price)
      SELECT s.order_id, p.id, s.quantity, p.price
      FROM (
        SELECT o.id AS order_id,
               b.min_id + floor(power(random(), 3) * b.n)::int AS product_id,
               1 + floor(random() * 3)::int AS quantity
        FROM orders o
        CROSS JOIN generate_series(1, 4) AS k
        CROSS JOIN (SELECT min(id) AS min_id, count(*) AS n FROM products) AS b
        WHERE o.id > ${lastOrderId}::int AND k <= 1 + o.id % 4
      ) AS s
      JOIN products p ON p.id = s.product_id
      ON CONFLICT (order_id, product_id) DO NOTHING`;

    await tx.$executeRaw`
      DELETE FROM orders o
      WHERE o.id > ${lastOrderId}::int
        AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)`;

    await tx.$executeRaw`
      UPDATE orders o SET total = s.total
      FROM (SELECT order_id, sum(quantity * unit_price) AS total
            FROM order_items WHERE order_id > ${lastOrderId}::int GROUP BY order_id) AS s
      WHERE o.id = s.order_id`;

    await tx.$executeRaw`
      INSERT INTO payments (order_id, amount, reference, paid_at)
      SELECT id, total, 'SIM-DEMO-' || id, completed_at
      FROM orders WHERE id > ${lastOrderId}::int`;

    await tx.$executeRaw`
      UPDATE products p SET units_sold = s.sold
      FROM (SELECT product_id, sum(quantity)::int AS sold FROM order_items GROUP BY product_id) AS s
      WHERE p.id = s.product_id`;

    // Cerca de un tercio de las compras tiene reseña, con más calificaciones altas.
    await tx.$executeRaw`
      WITH picked AS (
        SELECT DISTINCT ON (o.user_id, i.product_id)
               i.product_id, o.user_id, o.completed_at, random() AS r
        FROM orders o
        JOIN order_items i ON i.order_id = o.id
        WHERE o.id > ${lastOrderId}::int AND o.status = 'COMPLETED' AND random() < 0.35
        ORDER BY o.user_id, i.product_id, o.completed_at
      ), rated AS (
        SELECT product_id, user_id,
               CASE WHEN r < 0.50 THEN 5 WHEN r < 0.80 THEN 4 WHEN r < 0.90 THEN 3
                    WHEN r < 0.96 THEN 2 ELSE 1 END AS rating,
               least(completed_at + random() * interval '20 days', now()) AS at
        FROM picked
      )
      INSERT INTO reviews (product_id, user_id, rating, comment, created_at, updated_at)
      SELECT product_id, user_id, rating,
             CASE WHEN random() < 0.7
                  THEN (${REVIEW_COMMENTS}::text[])[(rating - 1) * 3 + 1 + floor(random() * 3)::int]
             END,
             at, at
      FROM rated
      ON CONFLICT (user_id, product_id) DO NOTHING`;
  },
  { maxWait: 5_000, timeout: 300_000 },
);

await invalidateCatalog();

const [categories, total, withImage, customers, orders, items, reviews] = await Promise.all([
  prisma.category.count(),
  prisma.product.count(),
  prisma.productImage.count(),
  prisma.user.count({ where: { email: { endsWith: '@demo.local' } } }),
  prisma.order.count(),
  prisma.orderItem.count(),
  prisma.review.count(),
]);
console.log(
  `Datos de demostración cargados en ${((Date.now() - startedAt) / 1000).toFixed(1)} s:\n` +
    `  categorías ${categories} · productos ${total} (${withImage} con imagen) · clientes ${customers}\n` +
    `  pedidos ${orders} · ítems ${items} · reseñas ${reviews}\n` +
    `  Contraseña de los clientes de demostración: ${DEMO_PASSWORD}`,
);

await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
