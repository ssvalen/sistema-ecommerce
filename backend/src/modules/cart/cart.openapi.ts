import {
  CartItemAddBodySchema,
  CartItemUpdateBodySchema,
  CartSchema,
  dataResponse,
  ProductIdParamsSchema,
} from '@sistema-e/contracts';
import { errorResponses, registry } from '../../docs/openapi.js';

const session = [{ cookieAuth: [] }];
const json = <T>(schema: T) => ({ 'application/json': { schema } });
const cartResponse = { description: 'Carrito', content: json(dataResponse(CartSchema)) };

registry.registerPath({
  method: 'get',
  path: '/cart',
  tags: ['Carrito'],
  summary: 'Ver el carrito',
  description: 'Precios actuales, subtotales y total calculados por el servidor.',
  security: session,
  responses: { 200: cartResponse, ...errorResponses(401, 403) },
});

registry.registerPath({
  method: 'post',
  path: '/cart/items',
  tags: ['Carrito'],
  summary: 'Agregar un producto',
  description: 'Suma la cantidad a la que ya hay en el carrito. Valida el stock disponible.',
  security: session,
  request: { body: { content: json(CartItemAddBodySchema) } },
  responses: { 200: cartResponse, ...errorResponses(400, 401, 403, 404, 409) },
});

registry.registerPath({
  method: 'patch',
  path: '/cart/items/{productId}',
  tags: ['Carrito'],
  summary: 'Cambiar la cantidad',
  security: session,
  request: { params: ProductIdParamsSchema, body: { content: json(CartItemUpdateBodySchema) } },
  responses: { 200: cartResponse, ...errorResponses(400, 401, 403, 404, 409) },
});

registry.registerPath({
  method: 'delete',
  path: '/cart/items/{productId}',
  tags: ['Carrito'],
  summary: 'Quitar un producto',
  security: session,
  request: { params: ProductIdParamsSchema },
  responses: { 204: { description: 'Quitado' }, ...errorResponses(400, 401, 403, 404) },
});
