import type { LoginBody, RegisterBody, User, UserRole } from '@sistema-e/contracts';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { queryKeys } from '@/shared/http/query-keys';
import { toast } from '@/shared/ui/toast';
import { authApi } from './api';

// Fuente de verdad: GET /auth/me.
export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => authApi.me(signal),
    staleTime: Infinity,
  });
  return { user: query.data ?? null, isPending: query.isPending };
}

/** Descarta los datos del usuario anterior. */
export function setSessionUser(queryClient: QueryClient, user: User | null): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
  });
  queryClient.setQueryData(queryKeys.session, user);
}

export function homePath(role: UserRole): string {
  return role === 'ADMIN' ? '/admin/products' : '/';
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginBody) => authApi.login(body),
    onSuccess: (user) => setSessionUser(queryClient, user),
  });
}

// El registro no abre sesión.
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: RegisterBody) => {
      await authApi.register(body);
      return authApi.login({ email: body.email, password: body.password });
    },
    onSuccess: (user) => {
      setSessionUser(queryClient, user);
      toast.success('Tu cuenta fue creada.');
    },
  });
}

// Navega antes de limpiar la sesión para que ningún guard redirija al login.
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      void navigate('/', { replace: true });
      setSessionUser(queryClient, null);
      toast.info('Cerraste sesión.');
    },
  });
}
