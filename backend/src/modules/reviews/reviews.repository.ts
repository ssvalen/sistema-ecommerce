import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/transaction.js';

const reviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { name: true } },
} satisfies Prisma.ReviewSelect;

export type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

export const reviewsRepository = {
  async listByProduct(
    db: Db,
    productId: number,
    skip: number,
    take: number,
  ): Promise<{ rows: ReviewRow[]; total: number }> {
    const [rows, total] = await Promise.all([
      db.review.findMany({
        where: { productId },
        select: reviewSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      db.review.count({ where: { productId } }),
    ]);
    return { rows, total };
  },

  findById(db: Db, id: number): Promise<ReviewRow | null> {
    return db.review.findUnique({ where: { id }, select: reviewSelect });
  },

  findByUser(db: Db, userId: number, productId: number): Promise<ReviewRow | null> {
    return db.review.findUnique({
      where: { userId_productId: { userId, productId } },
      select: reviewSelect,
    });
  },

  // Un solo INSERT ... ON CONFLICT: dos envíos simultáneos no chocan. xmax = 0 si la fila es nueva.
  async upsert(
    db: Db,
    data: { userId: number; productId: number; rating: number; comment: string | null },
  ): Promise<{ id: number; created: boolean }> {
    const rows = await db.$queryRaw<{ id: number; created: boolean }[]>`
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES (${data.productId}::int, ${data.userId}::int, ${data.rating}::smallint,
              ${data.comment}::varchar)
      ON CONFLICT (user_id, product_id) DO UPDATE
        SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()
      RETURNING id, (xmax = 0) AS created`;
    const row = rows[0];
    if (!row) throw new Error('El upsert de la reseña no devolvió la fila.');
    return row;
  },

  async deleteByUser(db: Db, userId: number, productId: number): Promise<boolean> {
    const { count } = await db.review.deleteMany({ where: { userId, productId } });
    return count === 1;
  },

  async deleteById(db: Db, id: number): Promise<boolean> {
    const { count } = await db.review.deleteMany({ where: { id } });
    return count === 1;
  },

  summarize(db: Db, productIds: number[]) {
    return db.review.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { _all: true },
      _avg: { rating: true },
    });
  },
};
