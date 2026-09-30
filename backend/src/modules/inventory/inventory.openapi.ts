import {
  dataResponse,
  InventoryAdjustmentBodySchema,
  InventoryItemSchema,
  paginatedResponse,
  PaginationQuerySchema,
  ProductIdParamsSchema,
} from '@sistema-e/contracts';
import { errorResponses, registry } from '../../docs/openapi.js';

const session = [{ cookieAuth: [] }];
const json = <T>(schema: T) => ({ 'application/json': { schema } });

registry.registerPath({
  method: 'get',
  path: '/inventory',
  tags: ['Inventario (admin)'],
  summary: 'Stock por producto',
  security: session,
  request: { query: PaginationQuerySchema },
  responses: {
    200: { description: 'Inventario', content: json(paginatedResponse(InventoryItemSchema)) },
    ...errorResponses(400, 401, 403),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/inventory/{productId}',
  tags: ['Inventario (admin)'],
  summary: 'Ajustar el stock',
  description:
    'Suma o resta unidades de forma atómica. Rechaza un ajuste que deje el stock en negativo.',
  security: session,
  request: {
    params: ProductIdParamsSchema,
    body: { content: json(InventoryAdjustmentBodySchema) },
  },
  responses: {
    200: { description: 'Stock actualizado', content: json(dataResponse(InventoryItemSchema)) },
    ...errorResponses(400, 401, 403, 404, 409),
  },
});
