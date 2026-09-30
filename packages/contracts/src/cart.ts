import { z } from 'zod';
import { MoneySchema } from './catalog.js';
import { IdSchema } from './common.js';

const QuantitySchema = z.number().int().min(1).max(1000);

export const CartItemSchema = z
  .object({
    productId: z.number().int(),
    name: z.string(),
    imageUrl: z.string().nullable(),
    unitPrice: MoneySchema,
    quantity: z.number().int(),
    subtotal: MoneySchema,
    stock: z.number().int(),
    available: z.boolean().meta({ description: 'false si el stock actual no cubre la cantidad' }),
  })
  .meta({ id: 'CartItem' });
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z
  .object({
    items: z.array(CartItemSchema),
    itemCount: z.number().int().meta({ description: 'Suma de las cantidades' }),
    total: MoneySchema,
  })
  .meta({ id: 'Cart' });
export type Cart = z.infer<typeof CartSchema>;

export const CartItemAddBodySchema = z
  .strictObject({
    productId: IdSchema,
    quantity: QuantitySchema.default(1).meta({ description: 'Se suma a la cantidad actual' }),
  })
  .meta({ id: 'CartItemAddBody' });
export type CartItemAddBody = z.infer<typeof CartItemAddBodySchema>;

export const CartItemUpdateBodySchema = z
  .strictObject({ quantity: QuantitySchema })
  .meta({ id: 'CartItemUpdateBody' });
export type CartItemUpdateBody = z.infer<typeof CartItemUpdateBodySchema>;
