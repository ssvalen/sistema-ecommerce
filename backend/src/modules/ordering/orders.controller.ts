import { IdParamsSchema, OrderListQuerySchema, PaymentBodySchema } from '@sistema-e/contracts';
import { handler } from '../../http/handler.js';
import { paginationMeta, sendData, sendPaginated } from '../../http/responses.js';
import { currentUser } from '../identity/index.js';
import * as orders from './orders.service.js';

export const createOrder = handler({}, async (_input, req, res) => {
  sendData(res, await orders.createOrder(currentUser(req).id), 201);
});

export const listOrders = handler({ query: OrderListQuerySchema }, async ({ query }, req, res) => {
  const { items, total } = await orders.listOrders(currentUser(req).id, query);
  sendPaginated(res, items, paginationMeta(query.page, query.pageSize, total));
});

export const getOrder = handler({ params: IdParamsSchema }, async ({ params }, req, res) => {
  sendData(res, await orders.getOrder(currentUser(req).id, params.id));
});

export const payOrder = handler(
  { params: IdParamsSchema, body: PaymentBodySchema },
  async ({ params, body }, req, res) => {
    sendData(res, await orders.payOrder(currentUser(req).id, params.id, body.simulatedResult));
  },
);
