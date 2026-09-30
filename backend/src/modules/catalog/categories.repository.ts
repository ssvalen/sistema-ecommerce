import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/transaction.js';

const categorySelect = { id: true, name: true, description: true } satisfies Prisma.CategorySelect;

export type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

export const categoriesRepository = {
  list(db: Db): Promise<CategoryRow[]> {
    return db.category.findMany({ select: categorySelect, orderBy: { name: 'asc' } });
  },

  findById(db: Db, id: number): Promise<CategoryRow | null> {
    return db.category.findUnique({ where: { id }, select: categorySelect });
  },

  create(db: Db, data: { name: string; description: string | null }): Promise<CategoryRow> {
    return db.category.create({ data, select: categorySelect });
  },

  update(
    db: Db,
    id: number,
    data: { name?: string; description?: string | null },
  ): Promise<CategoryRow> {
    return db.category.update({ where: { id }, data, select: categorySelect });
  },

  delete(db: Db, id: number): Promise<CategoryRow> {
    return db.category.delete({ where: { id }, select: categorySelect });
  },
};
