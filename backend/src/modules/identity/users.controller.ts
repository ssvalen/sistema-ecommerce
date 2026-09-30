import {
  IdParamsSchema,
  PaginationQuerySchema,
  UpdateUserStatusBodySchema,
} from '@sistema-e/contracts';
import { handler } from '../../http/handler.js';
import { paginationMeta, sendData, sendPaginated } from '../../http/responses.js';
import { currentUser } from './auth.middleware.js';
import * as usersService from './users.service.js';

export const listUsers = handler({ query: PaginationQuerySchema }, async ({ query }, _req, res) => {
  const { items, total } = await usersService.listUsers(query);
  sendPaginated(res, items, paginationMeta(query.page, query.pageSize, total));
});

export const getUser = handler({ params: IdParamsSchema }, async ({ params }, _req, res) => {
  sendData(res, await usersService.getUser(params.id));
});

export const updateUserStatus = handler(
  { params: IdParamsSchema, body: UpdateUserStatusBodySchema },
  async ({ params, body }, req, res) => {
    sendData(res, await usersService.setUserStatus(currentUser(req).id, params.id, body.status));
  },
);
