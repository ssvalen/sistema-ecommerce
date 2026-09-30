import type {
  LoginBody,
  PaginationQuery,
  RegisterBody,
  User,
  UserStatus,
} from '@sistema-e/contracts';
import { ApiError, http } from '@/shared/http/api-client';

export const authApi = {
  // 401/403: visitante.
  async me(signal?: AbortSignal): Promise<User | null> {
    try {
      return await http.get<User>('/auth/me', { signal });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
      throw error;
    }
  },
  login: (body: LoginBody) => http.post<User>('/auth/login', body),
  register: (body: RegisterBody) => http.post<User>('/auth/register', body),
  logout: () => http.post<void>('/auth/logout'),
};

export const usersApi = {
  list: (query: PaginationQuery, signal?: AbortSignal) =>
    http.page<User>('/users', { query, signal }),
  get: (id: number, signal?: AbortSignal) => http.get<User>(`/users/${id}`, { signal }),
  setStatus: (id: number, status: UserStatus) =>
    http.patch<User>(`/users/${id}/status`, { status }),
};
