import {
  CategoryCreateBodySchema,
  CategorySchema,
  CategoryUpdateBodySchema,
  dataResponse,
  IdParamsSchema,
  paginatedResponse,
  ProductCreateBodySchema,
  ProductListQuerySchema,
  ProductSchema,
  ProductUpdateBodySchema,
} from '@sistema-e/contracts';
import { z } from 'zod';
import { errorResponses, registry } from '../../docs/openapi.js';

const session = [{ cookieAuth: [] }];
const json = <T>(schema: T) => ({ 'application/json': { schema } });
const cacheHeader = {
  'X-Cache': {
    description: 'HIT, MISS o BYPASS (sin Redis)',
    schema: { type: 'string' as const },
  },
};
const categoryResponse = { description: 'Categoría', content: json(dataResponse(CategorySchema)) };
const productResponse = { description: 'Producto', content: json(dataResponse(ProductSchema)) };
const binary = z.string().meta({ format: 'binary' });

// Categorías

registry.registerPath({
  method: 'get',
  path: '/categories',
  tags: ['Categorías'],
  summary: 'Listar categorías',
  responses: {
    200: {
      description: 'Categorías ordenadas por nombre',
      headers: cacheHeader,
      content: json(dataResponse(z.array(CategorySchema))),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/categories/{id}',
  tags: ['Categorías'],
  summary: 'Consultar una categoría',
  request: { params: IdParamsSchema },
  responses: { 200: categoryResponse, ...errorResponses(400, 404) },
});

registry.registerPath({
  method: 'post',
  path: '/categories',
  tags: ['Categorías'],
  summary: 'Crear una categoría',
  security: session,
  request: { body: { content: json(CategoryCreateBodySchema) } },
  responses: {
    201: categoryResponse,
    ...errorResponses(400, 401, 403, 409),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/categories/{id}',
  tags: ['Categorías'],
  summary: 'Editar una categoría',
  security: session,
  request: { params: IdParamsSchema, body: { content: json(CategoryUpdateBodySchema) } },
  responses: { 200: categoryResponse, ...errorResponses(400, 401, 403, 404, 409) },
});

registry.registerPath({
  method: 'delete',
  path: '/categories/{id}',
  tags: ['Categorías'],
  summary: 'Eliminar una categoría',
  description: 'No se puede eliminar si tiene productos, incluidos los eliminados (409).',
  security: session,
  request: { params: IdParamsSchema },
  responses: { 204: { description: 'Eliminada' }, ...errorResponses(400, 401, 403, 404, 409) },
});

// Productos

registry.registerPath({
  method: 'get',
  path: '/products',
  tags: ['Productos'],
  summary: 'Catálogo',
  description: 'Búsqueda, filtros por categoría y precio, orden y paginación.',
  request: { query: ProductListQuerySchema },
  responses: {
    200: {
      description: 'Productos',
      headers: cacheHeader,
      content: json(paginatedResponse(ProductSchema)),
    },
    ...errorResponses(400),
  },
});

registry.registerPath({
  method: 'get',
  path: '/products/{id}',
  tags: ['Productos'],
  summary: 'Detalle de un producto',
  description: 'Sin caché: siempre muestra el stock real.',
  request: { params: IdParamsSchema },
  responses: { 200: productResponse, ...errorResponses(400, 404) },
});

registry.registerPath({
  method: 'post',
  path: '/products',
  tags: ['Productos'],
  summary: 'Crear un producto',
  security: session,
  request: { body: { content: json(ProductCreateBodySchema) } },
  responses: { 201: productResponse, ...errorResponses(400, 401, 403) },
});

registry.registerPath({
  method: 'patch',
  path: '/products/{id}',
  tags: ['Productos'],
  summary: 'Editar un producto',
  security: session,
  request: { params: IdParamsSchema, body: { content: json(ProductUpdateBodySchema) } },
  responses: { 200: productResponse, ...errorResponses(400, 401, 403, 404) },
});

registry.registerPath({
  method: 'delete',
  path: '/products/{id}',
  tags: ['Productos'],
  summary: 'Eliminar un producto',
  description: 'Borrado lógico: sale del catálogo y de los carritos; el historial se conserva.',
  security: session,
  request: { params: IdParamsSchema },
  responses: { 204: { description: 'Eliminado' }, ...errorResponses(400, 401, 403, 404) },
});

registry.registerPath({
  method: 'put',
  path: '/products/{id}/image',
  tags: ['Productos'],
  summary: 'Subir la imagen de un producto',
  description: 'JPEG, PNG o WebP de hasta 2 MB, en el campo `image`. Reemplaza la imagen actual.',
  security: session,
  request: {
    params: IdParamsSchema,
    body: { content: { 'multipart/form-data': { schema: z.object({ image: binary }) } } },
  },
  responses: { 200: productResponse, ...errorResponses(400, 401, 403, 404, 413, 415) },
});

registry.registerPath({
  method: 'get',
  path: '/images/{id}',
  tags: ['Productos'],
  summary: 'Imagen subida de un producto',
  description: 'Respuesta inmutable: `Cache-Control: public, max-age=31536000, immutable`.',
  request: { params: IdParamsSchema },
  responses: {
    200: { description: 'Imagen', content: { 'image/*': { schema: binary } } },
    ...errorResponses(400, 404),
  },
});
