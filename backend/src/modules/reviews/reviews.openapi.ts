import {
  dataResponse,
  IdParamsSchema,
  MyReviewSchema,
  paginatedResponse,
  ReviewBodySchema,
  ReviewListQuerySchema,
  ReviewSchema,
} from '@sistema-e/contracts';
import { errorResponses, registry } from '../../docs/openapi.js';

const session = [{ cookieAuth: [] }];
const json = <T>(schema: T) => ({ 'application/json': { schema } });
const reviewResponse = (description: string) => ({
  description,
  content: json(dataResponse(ReviewSchema)),
});

registry.registerPath({
  method: 'get',
  path: '/products/{id}/reviews',
  tags: ['Reseñas'],
  summary: 'Reseñas de un producto',
  description: 'Las más recientes primero.',
  request: { params: IdParamsSchema, query: ReviewListQuerySchema },
  responses: {
    200: { description: 'Reseñas', content: json(paginatedResponse(ReviewSchema)) },
    ...errorResponses(400, 404),
  },
});

registry.registerPath({
  method: 'get',
  path: '/products/{id}/reviews/me',
  tags: ['Reseñas'],
  summary: 'Mi reseña del producto',
  description: 'Indica si el cliente puede reseñar (compró el producto) y su reseña, si existe.',
  security: session,
  request: { params: IdParamsSchema },
  responses: {
    200: { description: 'Estado de la reseña', content: json(dataResponse(MyReviewSchema)) },
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'put',
  path: '/products/{id}/reviews/me',
  tags: ['Reseñas'],
  summary: 'Crear o reemplazar mi reseña',
  description:
    'Solo para clientes con un pedido completado que incluya el producto (si no, 403 REVIEW_NOT_ALLOWED). Una reseña por cliente y producto.',
  security: session,
  request: { params: IdParamsSchema, body: { content: json(ReviewBodySchema) } },
  responses: {
    200: reviewResponse('Reseña reemplazada'),
    201: reviewResponse('Reseña creada'),
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/products/{id}/reviews/me',
  tags: ['Reseñas'],
  summary: 'Eliminar mi reseña',
  security: session,
  request: { params: IdParamsSchema },
  responses: { 204: { description: 'Reseña eliminada' }, ...errorResponses(400, 401, 403, 404) },
});

registry.registerPath({
  method: 'delete',
  path: '/reviews/{id}',
  tags: ['Reseñas'],
  summary: 'Eliminar una reseña (admin)',
  security: session,
  request: { params: IdParamsSchema },
  responses: { 204: { description: 'Reseña eliminada' }, ...errorResponses(400, 401, 403, 404) },
});
