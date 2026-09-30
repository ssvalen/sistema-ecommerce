import { z } from 'zod';

export const IdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647)
  .meta({ description: 'Identificador numérico', example: 1 });

export const IdParamsSchema = z.strictObject({ id: IdSchema });
export type IdParams = z.infer<typeof IdParamsSchema>;

export const PaginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1).meta({ description: 'Página (desde 1)' }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .meta({ description: 'Elementos por página (máximo 100)' }),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginationMetaSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .meta({ id: 'PaginationMeta' });
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string().meta({ example: 'Los datos enviados no son válidos.' }),
      details: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
  })
  .meta({ id: 'ErrorResponse' });
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function dataResponse<T extends z.ZodType>(schema: T) {
  return z.object({ data: schema });
}

export function paginatedResponse<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: PaginationMetaSchema });
}
