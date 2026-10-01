import type { Order, OrderSummary, PaginationQuery } from '@sistema-e/contracts';
import { prisma } from '../../db/prisma.js';
import { withTransaction } from '../../db/transaction.js';
import { ConflictError, NotFoundError, PaymentDeclinedError } from '../../errors/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { lockCartForCheckout, removeOrderedItems } from '../cart/index.js';
import { userExists } from '../identity/index.js';
import { lockProductsForSale, recordSale } from '../inventory/index.js';
import { toOrder, toOrderSummary } from './order.mapper.js';
import { ordersRepository } from './orders.repository.js';
import { simulatePayment, type SimulatedResult } from './payment-simulator.js';

interface StockCheck {
  productId: number;
  name: string;
  requested: number;
  available: number;
  active: boolean;
}

const orderNotFound = () => new NotFoundError('El pedido no existe.');

function assertAvailable(checks: StockCheck[]): void {
  const unavailable = checks.filter((check) => !check.active);
  if (unavailable.length > 0) {
    throw new ConflictError(
      'PRODUCT_UNAVAILABLE',
      'Hay productos que ya no están disponibles.',
      unavailable.map(({ productId, name }) => ({ productId, name })),
    );
  }
  const short = checks.filter((check) => check.requested > check.available);
  if (short.length > 0) {
    throw new ConflictError(
      'INSUFFICIENT_STOCK',
      'No hay stock suficiente para algunos productos.',
      short.map(({ productId, name, requested, available }) => ({
        productId,
        name,
        requested,
        available,
      })),
    );
  }
}

// TX1: pedido y detalle desde el carrito. No toca el inventario.
export function createOrder(userId: number): Promise<Order> {
  return withTransaction(async (tx) => {
    const items = await lockCartForCheckout(tx, userId);
    if (items.length === 0) throw new ConflictError('CART_EMPTY', 'El carrito está vacío.');

    assertAvailable(
      items.map(({ productId, quantity, product }) => ({
        productId,
        name: product.name,
        requested: quantity,
        available: product.stock,
        active: product.deletedAt === null,
      })),
    );

    const total = items.reduce(
      (sum, item) => sum.add(item.product.price.mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const order = await ordersRepository.create(
      tx,
      userId,
      total,
      items.map(({ productId, quantity, product }) => ({
        productId,
        quantity,
        unitPrice: product.price,
      })),
    );
    await removeOrderedItems(
      tx,
      userId,
      items.map((item) => item.productId),
    );
    return toOrder(order);
  });
}

// TX2: pago simulado, descuento de inventario y pedido completado. Todo o nada.
export function payOrder(
  userId: number,
  orderId: number,
  simulatedResult: SimulatedResult,
): Promise<Order> {
  return withTransaction(async (tx) => {
    if (!(await ordersRepository.lockOwned(tx, orderId, userId))) throw orderNotFound();
    const order = await ordersRepository.findForPayment(tx, orderId);
    if (!order) throw orderNotFound();
    if (order.status !== 'PENDING_PAYMENT') {
      throw new ConflictError('ORDER_NOT_PENDING', 'El pedido ya fue pagado.');
    }

    const products = await lockProductsForSale(
      tx,
      order.items.map((item) => item.productId),
    );
    assertAvailable(
      order.items.map(({ productId, quantity }) => {
        const product = products.get(productId);
        return {
          productId,
          name: product?.name ?? '',
          requested: quantity,
          available: product?.stock ?? 0,
          active: product?.active ?? false,
        };
      }),
    );

    const payment = simulatePayment(simulatedResult);
    if (!payment.approved) throw new PaymentDeclinedError('El pago simulado fue rechazado.');

    await recordSale(tx, order.items);
    return toOrder(
      await ordersRepository.complete(tx, orderId, {
        amount: order.total,
        reference: payment.reference,
      }),
    );
  });
}

export async function listOrders(
  userId: number,
  { page, pageSize }: PaginationQuery,
): Promise<{ items: OrderSummary[]; total: number }> {
  const { rows, total } = await ordersRepository.listByUser(
    prisma,
    userId,
    (page - 1) * pageSize,
    pageSize,
  );
  return { items: rows.map(toOrderSummary), total };
}

// Admin: distingue un usuario inexistente de uno sin pedidos.
export async function listCustomerOrders(
  userId: number,
  query: PaginationQuery,
): Promise<{ items: OrderSummary[]; total: number }> {
  if (!(await userExists(prisma, userId))) throw new NotFoundError('El usuario no existe.');
  return listOrders(userId, query);
}

export async function getOrder(userId: number, orderId: number): Promise<Order> {
  const order = await ordersRepository.findOwned(prisma, orderId, userId);
  if (!order) throw orderNotFound();
  return toOrder(order);
}
