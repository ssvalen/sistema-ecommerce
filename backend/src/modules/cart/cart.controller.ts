import {
  CartItemAddBodySchema,
  CartItemUpdateBodySchema,
  ProductIdParamsSchema,
} from '@sistema-e/contracts';
import { handler } from '../../http/handler.js';
import { sendData, sendNoContent } from '../../http/responses.js';
import { currentUser } from '../identity/index.js';
import * as cart from './cart.service.js';

export const getCart = handler({}, async (_input, req, res) => {
  sendData(res, await cart.getCart(currentUser(req).id));
});

export const addItem = handler({ body: CartItemAddBodySchema }, async ({ body }, req, res) => {
  sendData(res, await cart.addItem(currentUser(req).id, body));
});

export const updateItem = handler(
  { params: ProductIdParamsSchema, body: CartItemUpdateBodySchema },
  async ({ params, body }, req, res) => {
    sendData(res, await cart.updateItem(currentUser(req).id, params.productId, body.quantity));
  },
);

export const removeItem = handler(
  { params: ProductIdParamsSchema },
  async ({ params }, req, res) => {
    await cart.removeItem(currentUser(req).id, params.productId);
    sendNoContent(res);
  },
);
