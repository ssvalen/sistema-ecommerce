import { z } from 'zod';
import { IdSchema } from './common.js';

export const ProductIdParamsSchema = z.strictObject({ productId: IdSchema });

export const InventoryItemSchema = z
  .object({
    productId: z.number().int(),
    name: z.string(),
    categoryName: z.string(),
    stock: z.number().int(),
    unitsSold: z.number().int(),
  })
  .meta({ id: 'InventoryItem' });
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const InventoryAdjustmentBodySchema = z
  .strictObject({
    adjustment: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((value) => value !== 0, { error: 'El ajuste no puede ser 0.' })
      .meta({ description: 'Unidades a sumar (positivo) o restar (negativo)', example: 10 }),
  })
  .meta({ id: 'InventoryAdjustmentBody' });
export type InventoryAdjustmentBody = z.infer<typeof InventoryAdjustmentBodySchema>;
