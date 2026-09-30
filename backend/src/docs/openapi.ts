import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { ErrorResponseSchema } from '@sistema-e/contracts';

export const registry = new OpenAPIRegistry();

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Datos de entrada inválidos',
  401: 'Sin sesión, o sesión inválida o expirada',
  402: 'Pago simulado rechazado',
  403: 'Rol no permitido o cuenta bloqueada',
  404: 'El recurso no existe',
  409: 'Conflicto con el estado actual de los datos',
  413: 'Cuerpo de la solicitud demasiado grande',
  503: 'Servicio no disponible temporalmente',
};

export function errorResponses(...statuses: number[]) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      {
        description: ERROR_DESCRIPTIONS[status] ?? 'Error',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    ]),
  );
}

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Sistema E · API',
      version: '1.0.0',
      description:
        'API REST del sistema de comercio electrónico. Respuestas exitosas: `{ data }` o `{ data, meta }`. Errores: `{ error: { code, message, details? } }`.',
    },
    servers: [{ url: '/api/v1' }],
  });
}
