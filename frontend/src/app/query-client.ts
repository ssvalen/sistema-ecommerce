import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { setSessionUser } from '@/modules/identity';
import { ApiError } from '@/shared/http/api-client';
import { markHandled } from '@/shared/http/errors';
import { queryKeys } from '@/shared/http/query-keys';
import { toast } from '@/shared/ui/toast';

const SESSION_LOST = new Set(['UNAUTHORIZED', 'SESSION_INVALID', 'ACCOUNT_BLOCKED']);

// Sesión expirada o cuenta bloqueada a mitad de uso.
function handleSessionLost(error: unknown): void {
  if (!(error instanceof ApiError) || !SESSION_LOST.has(error.code)) return;
  if (!queryClient.getQueryData(queryKeys.session)) return;
  markHandled(error);
  setSessionUser(queryClient, null);
  toast.error(error.message);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleSessionLost }),
  mutationCache: new MutationCache({ onError: handleSessionLost }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
    mutations: { retry: false },
  },
});
