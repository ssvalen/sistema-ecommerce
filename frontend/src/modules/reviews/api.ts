import type { MyReview, PaginationQuery, Review, ReviewBody } from '@sistema-e/contracts';
import { http } from '@/shared/http/api-client';

export const reviewsApi = {
  list: (productId: number, query: PaginationQuery, signal?: AbortSignal) =>
    http.page<Review>(`/products/${productId}/reviews`, { query, signal }),
  mine: (productId: number, signal?: AbortSignal) =>
    http.get<MyReview>(`/products/${productId}/reviews/me`, { signal }),
  save: (productId: number, body: ReviewBody) =>
    http.put<Review>(`/products/${productId}/reviews/me`, body),
  removeMine: (productId: number) => http.delete(`/products/${productId}/reviews/me`),
  remove: (id: number) => http.delete(`/reviews/${id}`),
};
