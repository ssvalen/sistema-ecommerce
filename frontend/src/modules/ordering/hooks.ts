import type { PaymentBody } from '@sistema-e/contracts';
import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { hasCode } from '@/shared/http/errors';
import { queryKeys } from '@/shared/http/query-keys';
import { customerOrdersApi, ordersApi } from './api';

export const ORDERS_PAGE_SIZE = 10;
const CUSTOMER_ORDERS_PAGE_SIZE = 10;

export function useOrders(page: number) {
  return useQuery({
    queryKey: queryKeys.orders.list(page),
    queryFn: ({ signal }) => ordersApi.list({ page, pageSize: ORDERS_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: id === null ? skipToken : ({ signal }) => ordersApi.get(id, signal),
  });
}

export function useCustomerOrders(userId: number, page: number) {
  return useQuery({
    queryKey: queryKeys.orders.customerList(userId, page),
    queryFn: ({ signal }) =>
      customerOrdersApi.list(userId, { page, pageSize: CUSTOMER_ORDERS_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerOrder(userId: number | null, orderId: number | null) {
  return useQuery({
    queryKey: queryKeys.orders.customerDetail(userId, orderId),
    queryFn:
      userId === null || orderId === null
        ? skipToken
        : ({ signal }) => customerOrdersApi.get(userId, orderId, signal),
  });
}

// TX1: también vacía el carrito.
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ordersApi.create(),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.cart }),
  });
}

// TX2: descuenta el stock.
export function usePayOrder(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentBody) => ordersApi.pay(id, body),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: (error) => {
      if (hasCode(error, 'ORDER_NOT_PENDING')) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      }
    },
  });
}
