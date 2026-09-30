import {
  InventoryAdjustmentBodySchema,
  PaginationQuerySchema,
  ProductIdParamsSchema,
} from '@sistema-e/contracts';
import { handler } from '../../http/handler.js';
import { paginationMeta, sendData, sendPaginated } from '../../http/responses.js';
import * as inventory from './inventory.service.js';

export const listInventory = handler(
  { query: PaginationQuerySchema },
  async ({ query }, _req, res) => {
    const { items, total } = await inventory.listInventory(query);
    sendPaginated(res, items, paginationMeta(query.page, query.pageSize, total));
  },
);

export const adjustStock = handler(
  { params: ProductIdParamsSchema, body: InventoryAdjustmentBodySchema },
  async ({ params, body }, _req, res) => {
    sendData(res, await inventory.adjustStock(params.productId, body.adjustment));
  },
);
