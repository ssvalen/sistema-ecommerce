import type { Cart, CartItemAddBody } from '@sistema-e/contracts';
import { http } from '@/shared/http/api-client';

export const cartApi = {
  get: (signal?: AbortSignal) => http.get<Cart>('/cart', { signal }),
  add: (body: CartItemAddBody) => http.post<Cart>('/cart/items', body),
  update: (productId: number, quantity: number) =>
    http.patch<Cart>(`/cart/items/${productId}`, { quantity }),
  remove: (productId: number) => http.delete(`/cart/items/${productId}`),
};
