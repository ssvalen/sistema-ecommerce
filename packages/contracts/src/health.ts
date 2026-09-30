import { z } from 'zod';

export const HealthCheckStatusSchema = z.enum(['up', 'down']);

export const HealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded', 'unavailable']).meta({
      description:
        'ok: todo disponible · degraded: sin caché, pero funcional · unavailable: sin base de datos',
    }),
    instance: z
      .string()
      .meta({ description: 'Instancia que atendió la solicitud', example: 'api-1' }),
    checks: z.object({
      database: HealthCheckStatusSchema,
      cache: HealthCheckStatusSchema,
    }),
  })
  .meta({ id: 'Health' });
export type Health = z.infer<typeof HealthSchema>;
