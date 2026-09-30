import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/transaction.js';

const cartItemSelect = {
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      externalImageUrl: true,
      image: { select: { id: true } },
    },
  },
} satisfies Prisma.CartItemSelect;

export type CartItemRow = Prisma.CartItemGetPayload<{ select: typeof cartItemSelect }>;

const key = (userId: number, productId: number) => ({ userId_productId: { userId, productId } });

export const cartRepository = {
  listByUser(db: Db, userId: number): Promise<CartItemRow[]> {
    return db.cartItem.findMany({
      where: { userId },
      select: cartItemSelect,
      orderBy: { createdAt: 'asc' },
    });
  },

  // INSERT ... ON CONFLICT DO UPDATE: suma de forma atómica y devuelve la cantidad final.
  upsertIncrement(db: Db, userId: number, productId: number, quantity: number) {
    return db.cartItem.upsert({
      where: key(userId, productId),
      create: { userId, productId, quantity },
      update: { quantity: { increment: quantity } },
      select: { quantity: true },
    });
  },

  setQuantity(db: Db, userId: number, productId: number, quantity: number) {
    return db.cartItem.update({
      where: key(userId, productId),
      data: { quantity },
      select: { quantity: true },
    });
  },

  delete(db: Db, userId: number, productId: number) {
    return db.cartItem.delete({ where: key(userId, productId), select: { productId: true } });
  },

  deleteByProduct(db: Db, productId: number) {
    return db.cartItem.deleteMany({ where: { productId } });
  },

  // Solo toma el lock: los datos se leen después con Prisma.
  async lockByUser(db: Db, userId: number): Promise<void> {
    await db.$queryRaw<{ product_id: number }[]>`
      SELECT product_id FROM cart_items WHERE user_id = ${userId} ORDER BY product_id FOR UPDATE`;
  },

  listForCheckout(db: Db, userId: number) {
    return db.cartItem.findMany({
      where: { userId },
      select: {
        productId: true,
        quantity: true,
        product: { select: { name: true, price: true, stock: true, deletedAt: true } },
      },
      orderBy: { productId: 'asc' },
    });
  },

  deleteItems(db: Db, userId: number, productIds: number[]) {
    return db.cartItem.deleteMany({ where: { userId, productId: { in: productIds } } });
  },
};
