import type { Order, OrderSummary } from '@sistema-e/contracts';
import { productImageUrl } from '../catalog/index.js';
import type { OrderDetailRow, OrderSummaryRow } from './orders.repository.js';

type OrderBase = Pick<OrderSummaryRow, 'id' | 'status' | 'total' | 'createdAt' | 'completedAt'>;

function toBase(row: OrderBase, itemCount: number): OrderSummary {
  return {
    id: row.id,
    status: row.status,
    total: row.total.toFixed(2),
    itemCount,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

const sumQuantities = (items: { quantity: number }[]) =>
  items.reduce((sum, item) => sum + item.quantity, 0);

export function toOrderSummary(row: OrderSummaryRow): OrderSummary {
  return toBase(row, sumQuantities(row.items));
}

export function toOrder(row: OrderDetailRow): Order {
  return {
    ...toBase(row, sumQuantities(row.items)),
    items: row.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      imageUrl: productImageUrl(item.product),
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      subtotal: item.unitPrice.mul(item.quantity).toFixed(2),
    })),
    payment: row.payment
      ? {
          reference: row.payment.reference,
          amount: row.payment.amount.toFixed(2),
          paidAt: row.payment.paidAt.toISOString(),
        }
      : null,
  };
}
