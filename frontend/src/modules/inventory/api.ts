import type { InventoryItem, PaginationQuery } from '@sistema-e/contracts';
import { http } from '@/shared/http/api-client';

export const inventoryApi = {
  list: (query: PaginationQuery, signal?: AbortSignal) =>
    http.page<InventoryItem>('/inventory', { query, signal }),
  adjust: (productId: number, adjustment: number) =>
    http.patch<InventoryItem>(`/inventory/${productId}`, { adjustment }),
};
