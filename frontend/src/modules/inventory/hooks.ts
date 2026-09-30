import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/http/query-keys';
import { inventoryApi } from './api';

export const INVENTORY_PAGE_SIZE = 20;

export function useInventory(page: number) {
  return useQuery({
    queryKey: queryKeys.inventory.list(page),
    queryFn: ({ signal }) => inventoryApi.list({ page, pageSize: INVENTORY_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, adjustment }: { productId: number; adjustment: number }) =>
      inventoryApi.adjust(productId, adjustment),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
