import { z } from 'zod';
import { PaginationQuerySchema } from './common.js';

const ratingError = { error: 'Elige de 1 a 5 estrellas.' };

export const RatingSummarySchema = z
  .object({
    average: z
      .number()
      .nullable()
      .meta({ description: 'Promedio con un decimal; null si no hay reseñas', example: 4.3 }),
    count: z.number().int(),
  })
  .meta({ id: 'RatingSummary' });
export type RatingSummary = z.infer<typeof RatingSummarySchema>;

export const ReviewSchema = z
  .object({
    id: z.number().int(),
    rating: z.number().int(),
    comment: z.string().nullable(),
    authorName: z
      .string()
      .meta({ description: 'Nombre e inicial del apellido', example: 'Ana L.' }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Review' });
export type Review = z.infer<typeof ReviewSchema>;

export const ReviewListQuerySchema = PaginationQuerySchema;

export const ReviewBodySchema = z
  .strictObject({
    rating: z
      .number(ratingError)
      .int(ratingError)
      .min(1, ratingError)
      .max(5, ratingError)
      .meta({ description: 'De 1 a 5 estrellas', example: 5 }),
    comment: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform((value) => value || null)
      .meta({ description: 'Opcional; vacío equivale a null' }),
  })
  .meta({ id: 'ReviewBody' });
export type ReviewBody = z.infer<typeof ReviewBodySchema>;

export const MyReviewSchema = z
  .object({
    canReview: z
      .boolean()
      .meta({ description: 'Tiene un pedido completado que incluye el producto' }),
    authorName: z.string().meta({ description: 'Nombre con que se publica la reseña' }),
    review: ReviewSchema.nullable(),
  })
  .meta({ id: 'MyReview' });
export type MyReview = z.infer<typeof MyReviewSchema>;
