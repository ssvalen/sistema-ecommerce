import type { MyReview, Review, ReviewBody } from '@sistema-e/contracts';
import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/shared/http/query-keys';
import { reviewsApi } from './api';

export const REVIEWS_PAGE_SIZE = 5;

export function useReviews(productId: number, page: number) {
  return useQuery({
    queryKey: queryKeys.reviews.list(productId, page),
    queryFn: ({ signal }) =>
      reviewsApi.list(productId, { page, pageSize: REVIEWS_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useMyReview(productId: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reviews.mine(productId),
    queryFn: enabled ? ({ signal }) => reviewsApi.mine(productId, signal) : skipToken,
  });
}

function updateReviews(queryClient: QueryClient, productId: number, review: Review | null) {
  queryClient.setQueryData<MyReview>(queryKeys.reviews.mine(productId), (mine) =>
    mine ? { ...mine, review } : mine,
  );
  invalidateReviews(queryClient, productId);
}

// El detalle del producto trae la calificación promedio.
function invalidateReviews(queryClient: QueryClient, productId: number) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.product(productId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
}

export function useSaveReview(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReviewBody) => reviewsApi.save(productId, body),
    onSuccess: (review) => updateReviews(queryClient, productId, review),
  });
}

export function useDeleteMyReview(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reviewsApi.removeMine(productId),
    onSuccess: () => updateReviews(queryClient, productId, null),
  });
}

export function useDeleteReview(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reviewsApi.remove(id),
    onSuccess: () => invalidateReviews(queryClient, productId),
  });
}
