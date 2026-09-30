import type { UserStatus } from '@sistema-e/contracts';
import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/shared/http/query-keys';
import { usersApi } from './api';

export const USERS_PAGE_SIZE = 20;

export function useUsers(page: number) {
  return useQuery({
    queryKey: queryKeys.users.list(page),
    queryFn: ({ signal }) => usersApi.list({ page, pageSize: USERS_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: number | null) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: id === null ? skipToken : ({ signal }) => usersApi.get(id, signal),
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: UserStatus }) =>
      usersApi.setStatus(id, status),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.users.detail(user.id), user);
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
