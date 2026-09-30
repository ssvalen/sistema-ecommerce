import { z } from 'zod';
import { IdSchema, PaginationQuerySchema } from './common.js';

const hasAnyField = (body: Record<string, unknown>) =>
  Object.values(body).some((value) => value !== undefined);

export const MoneySchema = z
  .string()
  .regex(/^\d+\.\d{2}$/)
  .meta({ description: 'Monto con dos decimales', example: '199.90' });

export const MoneyInputSchema = z
  .union([z.number(), z.string().trim()])
  .transform(String)
  .pipe(
    z
      .string()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, { error: 'Debe ser un monto con hasta 2 decimales.' }),
  )
  .refine((value) => Number(value) > 0, { error: 'Debe ser mayor que 0.' })
  .meta({ description: 'Monto mayor que 0, con hasta 2 decimales', example: '199.90' });

export const HttpsUrlSchema = z
  .url({ protocol: /^https$/, error: 'Debe ser una URL https.' })
  .max(2048)
  .meta({ example: 'https://example.com/imagen.jpg' });

// Categorías

export const CategorySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
  })
  .meta({ id: 'Category' });
export type Category = z.infer<typeof CategorySchema>;

const CategoryNameSchema = z.string().trim().min(1).max(80).meta({ example: 'Calzado' });
const CategoryDescriptionSchema = z.string().trim().max(500).nullable();

export const CategoryCreateBodySchema = z
  .strictObject({
    name: CategoryNameSchema,
    description: CategoryDescriptionSchema.optional(),
  })
  .meta({ id: 'CategoryCreateBody' });
export type CategoryCreateBody = z.infer<typeof CategoryCreateBodySchema>;

export const CategoryUpdateBodySchema = z
  .strictObject({
    name: CategoryNameSchema.optional(),
    description: CategoryDescriptionSchema.optional(),
  })
  .refine(hasAnyField, { error: 'Envía al menos un campo.' })
  .meta({ id: 'CategoryUpdateBody' });
export type CategoryUpdateBody = z.infer<typeof CategoryUpdateBodySchema>;

// Productos

export const ProductSortSchema = z.enum(['newest', 'popularity']);

export const ProductListQuerySchema = PaginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined)
    .meta({ description: 'Busca en nombre y descripción' }),
  categoryId: IdSchema.optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: ProductSortSchema.default('newest').meta({
    description: 'newest: más recientes · popularity: más vendidos',
  }),
}).refine(
  (query) =>
    query.minPrice === undefined ||
    query.maxPrice === undefined ||
    query.minPrice <= query.maxPrice,
  { error: 'minPrice no puede ser mayor que maxPrice.', path: ['minPrice'] },
);
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const ProductSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string(),
    price: MoneySchema,
    imageUrl: z.string().nullable(),
    stock: z.number().int(),
    unitsSold: z.number().int(),
    category: z.object({ id: z.number().int(), name: z.string() }),
  })
  .meta({ id: 'Product' });
export type Product = z.infer<typeof ProductSchema>;

const ProductNameSchema = z.string().trim().min(1).max(150).meta({ example: 'Zapatilla urbana' });
const ProductDescriptionSchema = z.string().trim().max(5000);

export const ProductCreateBodySchema = z
  .strictObject({
    categoryId: IdSchema,
    name: ProductNameSchema,
    description: ProductDescriptionSchema.default(''),
    price: MoneyInputSchema,
    stock: z.number().int().min(0).max(1_000_000).default(0).meta({ description: 'Stock inicial' }),
    imageUrl: HttpsUrlSchema.nullable().optional(),
  })
  .meta({ id: 'ProductCreateBody' });
export type ProductCreateBody = z.infer<typeof ProductCreateBodySchema>;

export const ProductUpdateBodySchema = z
  .strictObject({
    categoryId: IdSchema.optional(),
    name: ProductNameSchema.optional(),
    description: ProductDescriptionSchema.optional(),
    price: MoneyInputSchema.optional(),
    imageUrl: HttpsUrlSchema.nullable().optional().meta({ description: 'null quita la imagen' }),
  })
  .refine(hasAnyField, { error: 'Envía al menos un campo.' })
  .meta({ id: 'ProductUpdateBody', description: 'El stock se modifica con /inventory.' });
export type ProductUpdateBody = z.infer<typeof ProductUpdateBodySchema>;
