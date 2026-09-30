import type { Cart, CartItemAddBody } from '@sistema-e/contracts';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/modules/identity';
import { hasCode } from '@/shared/http/errors';
import { queryKeys } from '@/shared/http/query-keys';
import { cartApi } from './api';

// A un administrador el backend responde 403.
export function useCart() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: user?.role === 'CUSTOMER' ? ({ signal }) => cartApi.get(signal) : skipToken,
  });
}

export function useCartCount(): number {
  return useCart().data?.itemCount ?? 0;
}

function useCartMutation<T>(mutationFn: (input: T) => Promise<Cart | void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (cart) => {
      if (cart) queryClient.setQueryData(queryKeys.cart, cart);
      else void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
    onError: (error) => {
      // El stock cambió.
      if (hasCode(error, 'INSUFFICIENT_STOCK', 'NOT_FOUND')) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
        void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      }
    },
  });
}

export const useAddToCart = () => useCartMutation((body: CartItemAddBody) => cartApi.add(body));

export const useUpdateCartItem = () =>
  useCartMutation(({ productId, quantity }: { productId: number; quantity: number }) =>
    cartApi.update(productId, quantity),
  );

export const useRemoveCartItem = () =>
  useCartMutation((productId: number) => cartApi.remove(productId));
