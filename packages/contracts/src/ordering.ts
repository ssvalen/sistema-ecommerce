import { z } from 'zod';
import { MoneySchema } from './catalog.js';
import { PaginationQuerySchema } from './common.js';

export const OrderStatusSchema = z.enum(['PENDING_PAYMENT', 'COMPLETED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z
  .object({
    productId: z.number().int(),
    name: z.string(),
    imageUrl: z.string().nullable(),
    quantity: z.number().int(),
    unitPrice: MoneySchema.meta({ description: 'Precio al momento de crear el pedido' }),
    subtotal: MoneySchema,
  })
  .meta({ id: 'OrderItem' });

export const PaymentSchema = z
  .object({
    reference: z.string().meta({ example: 'SIM-3f2b9c1e-6a4d-4e1a-9f7b-2c8d5e0a1b34' }),
    amount: MoneySchema,
    paidAt: z.iso.datetime(),
  })
  .meta({ id: 'Payment' });

export const OrderSummarySchema = z
  .object({
    id: z.number().int(),
    status: OrderStatusSchema,
    total: MoneySchema,
    itemCount: z.number().int().meta({ description: 'Suma de las cantidades' }),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'OrderSummary' });
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

export const OrderSchema = OrderSummarySchema.extend({
  items: z.array(OrderItemSchema),
  payment: PaymentSchema.nullable(),
}).meta({ id: 'Order' });
export type Order = z.infer<typeof OrderSchema>;

export const OrderListQuerySchema = PaginationQuerySchema;

export const PaymentBodySchema = z
  .strictObject({
    simulatedResult: z
      .enum(['APPROVED', 'DECLINED'])
      .default('APPROVED')
      .meta({ description: 'Pago simulado: DECLINED fuerza un rechazo (demostración)' }),
  })
  .default({ simulatedResult: 'APPROVED' })
  .meta({ id: 'PaymentBody' });
export type PaymentBody = z.infer<typeof PaymentBodySchema>;
