import type { ProductListQuery } from '@sistema-e/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/transaction.js';

const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  externalImageUrl: true,
  stock: true,
  unitsSold: true,
  category: { select: { id: true, name: true } },
  image: { select: { id: true } }, // nunca `data`
} satisfies Prisma.ProductSelect;

export type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function listWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const hasPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;
  return {
    deletedAt: null,
    ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
    ...(hasPriceFilter ? { price: { gte: query.minPrice, lte: query.maxPrice } } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export const productsRepository = {
  async list(db: Db, query: ProductListQuery): Promise<{ rows: ProductRow[]; total: number }> {
    const where = listWhere(query);
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'popularity' ? [{ unitsSold: 'desc' }, { id: 'desc' }] : [{ id: 'desc' }];
    const [rows, total] = await Promise.all([
      db.product.findMany({
        where,
        select: productSelect,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.product.count({ where }),
    ]);
    return { rows, total };
  },

  findActiveById(db: Db, id: number): Promise<ProductRow | null> {
    return db.product.findFirst({ where: { id, deletedAt: null }, select: productSelect });
  },

  create(db: Db, data: Prisma.ProductUncheckedCreateInput): Promise<ProductRow> {
    return db.product.create({ data, select: productSelect });
  },

  // Solo productos activos: si no existe o está eliminado, Prisma lanza P2025.
  update(db: Db, id: number, data: Prisma.ProductUncheckedUpdateInput): Promise<ProductRow> {
    return db.product.update({ where: { id, deletedAt: null }, data, select: productSelect });
  },

  softDelete(db: Db, id: number) {
    return db.product.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  },
};
