import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/transaction.js';

const summarySelect = {
  id: true,
  status: true,
  total: true,
  createdAt: true,
  completedAt: true,
  items: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

const detailSelect = {
  id: true,
  status: true,
  total: true,
  createdAt: true,
  completedAt: true,
  items: {
    select: {
      productId: true,
      quantity: true,
      unitPrice: true,
      product: { select: { name: true, externalImageUrl: true, image: { select: { id: true } } } },
    },
    orderBy: { productId: 'asc' },
  },
  payment: { select: { reference: true, amount: true, paidAt: true } },
} satisfies Prisma.OrderSelect;

export type OrderSummaryRow = Prisma.OrderGetPayload<{ select: typeof summarySelect }>;
export type OrderDetailRow = Prisma.OrderGetPayload<{ select: typeof detailSelect }>;

export interface NewOrderItem {
  productId: number;
  quantity: number;
  unitPrice: Prisma.Decimal;
}

export const ordersRepository = {
  create(
    db: Db,
    userId: number,
    total: Prisma.Decimal,
    items: NewOrderItem[],
  ): Promise<OrderDetailRow> {
    return db.order.create({
      data: { userId, total, items: { createMany: { data: items } } },
      select: detailSelect,
    });
  },

  // La condición de dueño va en el lock: un pedido ajeno no existe para el cliente.
  async lockOwned(db: Db, orderId: number, userId: number): Promise<boolean> {
    const rows = await db.$queryRaw<{ id: number }[]>`
      SELECT id FROM orders WHERE id = ${orderId} AND user_id = ${userId} FOR UPDATE`;
    return rows.length === 1;
  },

  findForPayment(db: Db, orderId: number) {
    return db.order.findUnique({
      where: { id: orderId },
      select: { status: true, total: true, items: { select: { productId: true, quantity: true } } },
    });
  },

  async complete(
    db: Db,
    orderId: number,
    payment: { amount: Prisma.Decimal; reference: string },
  ): Promise<OrderDetailRow> {
    await db.payment.create({ data: { orderId, ...payment } });
    return db.order.update({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status: 'COMPLETED', completedAt: new Date() },
      select: detailSelect,
    });
  },

  async listByUser(
    db: Db,
    userId: number,
    skip: number,
    take: number,
  ): Promise<{ rows: OrderSummaryRow[]; total: number }> {
    const [rows, total] = await Promise.all([
      db.order.findMany({
        where: { userId },
        select: summarySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      db.order.count({ where: { userId } }),
    ]);
    return { rows, total };
  },

  findOwned(db: Db, orderId: number, userId: number): Promise<OrderDetailRow | null> {
    return db.order.findFirst({ where: { id: orderId, userId }, select: detailSelect });
  },
};
