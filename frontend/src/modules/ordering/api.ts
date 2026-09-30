import type { Order, OrderSummary, PaginationQuery, PaymentBody } from '@sistema-e/contracts';
import { http } from '@/shared/http/api-client';

export const ordersApi = {
  create: () => http.post<Order>('/orders'),
  list: (query: PaginationQuery, signal?: AbortSignal) =>
    http.page<OrderSummary>('/orders', { query, signal }),
  get: (id: number, signal?: AbortSignal) => http.get<Order>(`/orders/${id}`, { signal }),
  pay: (id: number, body: PaymentBody) => http.post<Order>(`/orders/${id}/payment`, body),
};
