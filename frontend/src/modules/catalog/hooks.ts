import type {
  CategoryCreateBody,
  CategoryUpdateBody,
  ProductCreateBody,
  ProductListQuery,
  ProductUpdateBody,
} from '@sistema-e/contracts';
import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/shared/http/query-keys';
import { categoriesApi, productsApi } from './api';

export function useProducts(query: ProductListQuery | null) {
  return useQuery({
    queryKey: queryKeys.products.list(query),
    queryFn: query ? ({ signal }) => productsApi.list(query, signal) : skipToken,
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: id === null ? skipToken : ({ signal }) => productsApi.get(id, signal),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => categoriesApi.list(signal),
    staleTime: 5 * 60_000,
  });
}

function invalidateCatalog(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductCreateBody) => productsApi.create(body),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProductUpdateBody }) =>
      productsApi.update(id, body),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useUploadProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => productsApi.uploadImage(id, file),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => {
      invalidateCatalog(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

function useCategoryMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      invalidateCatalog(queryClient);
    },
  });
}

export const useCreateCategory = () =>
  useCategoryMutation((body: CategoryCreateBody) => categoriesApi.create(body));

export const useUpdateCategory = () =>
  useCategoryMutation(({ id, body }: { id: number; body: CategoryUpdateBody }) =>
    categoriesApi.update(id, body),
  );

export const useDeleteCategory = () =>
  useCategoryMutation((id: number) => categoriesApi.remove(id));
