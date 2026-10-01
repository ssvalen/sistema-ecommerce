import {
  CustomerOrderParamsSchema,
  dataResponse,
  IdParamsSchema,
  OrderListQuerySchema,
  OrderSchema,
  OrderSummarySchema,
  paginatedResponse,
  PaymentBodySchema,
} from '@sistema-e/contracts';
import { errorResponses, registry } from '../../docs/openapi.js';

const session = [{ cookieAuth: [] }];
const json = <T>(schema: T) => ({ 'application/json': { schema } });
const orderResponse = { description: 'Pedido', content: json(dataResponse(OrderSchema)) };

registry.registerPath({
  method: 'post',
  path: '/orders',
  tags: ['Pedidos'],
  summary: 'Crear un pedido desde el carrito',
  description:
    'Valida disponibilidad, congela los precios y vacía el carrito. Queda en PENDING_PAYMENT; no descuenta inventario.',
  security: session,
  responses: { 201: orderResponse, ...errorResponses(401, 403, 409) },
});

registry.registerPath({
  method: 'get',
  path: '/orders',
  tags: ['Pedidos'],
  summary: 'Historial de pedidos',
  security: session,
  request: { query: OrderListQuerySchema },
  responses: {
    200: { description: 'Pedidos', content: json(paginatedResponse(OrderSummarySchema)) },
    ...errorResponses(400, 401, 403),
  },
});

registry.registerPath({
  method: 'get',
  path: '/orders/{id}',
  tags: ['Pedidos'],
  summary: 'Detalle de un pedido',
  security: session,
  request: { params: IdParamsSchema },
  responses: { 200: orderResponse, ...errorResponses(400, 401, 403, 404) },
});

registry.registerPath({
  method: 'post',
  path: '/orders/{id}/payment',
  tags: ['Pedidos'],
  summary: 'Pagar un pedido (pago simulado)',
  description:
    'En una transacción: revalida stock, ejecuta el pago simulado, registra el pago, descuenta inventario y completa el pedido. Si algo falla, no cambia nada.',
  security: session,
  request: { params: IdParamsSchema, body: { required: false, content: json(PaymentBodySchema) } },
  responses: { 200: orderResponse, ...errorResponses(400, 401, 402, 403, 404, 409, 503) },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}/orders',
  tags: ['Usuarios (admin)'],
  summary: 'Pedidos de un usuario',
  security: session,
  request: { params: IdParamsSchema, query: OrderListQuerySchema },
  responses: {
    200: { description: 'Pedidos', content: json(paginatedResponse(OrderSummarySchema)) },
    ...errorResponses(400, 401, 403, 404),
  },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}/orders/{orderId}',
  tags: ['Usuarios (admin)'],
  summary: 'Detalle de un pedido de un usuario',
  description: 'Solo lectura.',
  security: session,
  request: { params: CustomerOrderParamsSchema },
  responses: { 200: orderResponse, ...errorResponses(400, 401, 403, 404) },
});
