import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/transaction.js';

const inventorySelect = {
  id: true,
  name: true,
  stock: true,
  unitsSold: true,
  category: { select: { name: true } },
} satisfies Prisma.ProductSelect;

export type InventoryRow = Prisma.ProductGetPayload<{ select: typeof inventorySelect }>;

const active = (id?: number) => ({ deletedAt: null, ...(id !== undefined ? { id } : {}) });

export const inventoryRepository = {
  async list(db: Db, skip: number, take: number): Promise<{ rows: InventoryRow[]; total: number }> {
    const [rows, total] = await Promise.all([
      db.product.findMany({
        where: active(),
        select: inventorySelect,
        orderBy: { id: 'asc' },
        skip,
        take,
      }),
      db.product.count({ where: active() }),
    ]);
    return { rows, total };
  },

  findActive(db: Db, productId: number): Promise<InventoryRow | null> {
    return db.product.findFirst({ where: active(productId), select: inventorySelect });
  },

  // Orden fijo por id: dos pagos concurrentes no pueden bloquearse mutuamente.
  async lockByIds(db: Db, productIds: number[]): Promise<void> {
    await db.$queryRaw<{ id: number }[]>`
      SELECT id FROM products WHERE id = ANY(${productIds}::int[]) ORDER BY id FOR UPDATE`;
  },

  findForSale(db: Db, productIds: number[]) {
    return db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock: true, deletedAt: true },
    });
  },

  recordSale(db: Db, productId: number, quantity: number) {
    return db.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity }, unitsSold: { increment: quantity } },
      select: { id: true },
    });
  },

  // Un solo UPDATE condicional: no pisa una venta concurrente ni deja stock negativo.
  async adjust(db: Db, productId: number, adjustment: number): Promise<boolean> {
    const { count } = await db.product.updateMany({
      where: { ...active(productId), stock: { gte: -adjustment } },
      data: { stock: { increment: adjustment } },
    });
    return count === 1;
  },
};
