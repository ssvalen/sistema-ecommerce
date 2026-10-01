import { IdParamsSchema, ReviewBodySchema, ReviewListQuerySchema } from '@sistema-e/contracts';
import { handler } from '../../http/handler.js';
import { paginationMeta, sendData, sendNoContent, sendPaginated } from '../../http/responses.js';
import { currentUser } from '../identity/index.js';
import * as reviews from './reviews.service.js';

export const listReviews = handler(
  { params: IdParamsSchema, query: ReviewListQuerySchema },
  async ({ params, query }, _req, res) => {
    const { items, total } = await reviews.listReviews(params.id, query);
    sendPaginated(res, items, paginationMeta(query.page, query.pageSize, total));
  },
);

export const getMyReview = handler({ params: IdParamsSchema }, async ({ params }, req, res) => {
  sendData(res, await reviews.getMyReview(currentUser(req), params.id));
});

export const saveMyReview = handler(
  { params: IdParamsSchema, body: ReviewBodySchema },
  async ({ params, body }, req, res) => {
    const { review, created } = await reviews.saveMyReview(currentUser(req).id, params.id, body);
    sendData(res, review, created ? 201 : 200);
  },
);

export const deleteMyReview = handler({ params: IdParamsSchema }, async ({ params }, req, res) => {
  await reviews.deleteMyReview(currentUser(req).id, params.id);
  sendNoContent(res);
});

export const deleteReview = handler({ params: IdParamsSchema }, async ({ params }, _req, res) => {
  await reviews.deleteReview(params.id);
  sendNoContent(res);
});
