// Datos de demostración con volumen. Solo corre si no hay productos.
// Uso: pnpm seed:demo
import { invalidateCatalog } from '../src/cache/catalog-cache.js';
import { redis } from '../src/cache/redis.js';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/modules/identity/password.js';

const PRODUCTS = 50_000;
const CUSTOMERS = 2_000;
const ORDERS = 20_000;
const DEMO_PASSWORD = 'demo-cliente-123';

const CATEGORIES = [
  'Calzado',
  'Ropa',
  'Accesorios',
  'Electrónica',
  'Hogar',
  'Cocina',
  'Deportes',
  'Juguetes',
  'Libros',
  'Belleza',
  'Jardín',
  'Oficina',
];
const NOUNS = ['Camisa', 'Zapatilla', 'Lámpara', 'Mochila', 'Reloj', 'Taza', 'Balón', 'Cuaderno'];
const ADJECTIVES = ['clásica', 'urbana', 'premium', 'compacta', 'deportiva', 'ecológica'];
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

const products = await prisma.product.count();
if (products > 0) {
  console.error(
    `La base ya tiene ${products} productos: seed:demo solo corre sobre un catálogo vacío.`,
  );
  process.exit(1);
}

const passwordHash = await hashPassword(DEMO_PASSWORD);
const startedAt = Date.now();

await prisma.$transaction(
  async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '5min'`;

    const [{ lastOrderId } = { lastOrderId: 0 }] = await tx.$queryRaw<{ lastOrderId: number }[]>`
      SELECT coalesce(max(id), 0)::int AS "lastOrderId" FROM orders`;

    await tx.$executeRaw`
      INSERT INTO categories (name, description)
      SELECT name, 'Categoría de demostración'
      FROM unnest(${CATEGORIES}::text[]) AS name
      ON CONFLICT (name) DO NOTHING`;

    await tx.$executeRaw`
      WITH words AS (SELECT ${NOUNS}::text[] AS noun, ${ADJECTIVES}::text[] AS adj),
           cats AS (SELECT array_agg(id ORDER BY id) AS ids FROM categories)
      INSERT INTO products (category_id, name, description, price, stock, created_at, updated_at)
      SELECT cats.ids[1 + floor(random() * cardinality(cats.ids))::int],
             words.noun[1 + g % cardinality(words.noun)] || ' '
               || words.adj[1 + (g / cardinality(words.noun)) % cardinality(words.adj)] || ' ' || g,
             'Producto de demostración número ' || g || '.',
             round((5 + random() * 1995)::numeric, 2),
             floor(random() * 500)::int,
             now() - random() * interval '365 days',
             now()
      FROM generate_series(1, ${PRODUCTS}::int) AS g, words, cats`;

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

const [categories, total, customers, orders, items, reviews] = await Promise.all([
  prisma.category.count(),
  prisma.product.count(),
  prisma.user.count({ where: { email: { endsWith: '@demo.local' } } }),
  prisma.order.count(),
  prisma.orderItem.count(),
  prisma.review.count(),
]);
console.log(
  `Datos de demostración cargados en ${((Date.now() - startedAt) / 1000).toFixed(1)} s:\n` +
    `  categorías ${categories} · productos ${total} · clientes ${customers} · pedidos ${orders} · ítems ${items} · reseñas ${reviews}\n` +
    `  Contraseña de los clientes de demostración: ${DEMO_PASSWORD}`,
);

await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
