import type { PaginationMeta } from '@sistema-e/contracts';

export type ErrorDetail = Record<string, unknown>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];

  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

const BASE_URL = '/api/v1';

function toQueryString(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isErrorBody(
  body: unknown,
): body is { error: { code: string; message: string; details?: ErrorDetail[] } } {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const { error } = body;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

// Sin JSON: respuesta de NGINX (502/504, 413).
function fallbackError(status: number): ApiError {
  if (status === 413) {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El archivo es demasiado grande.');
  }
  if (status >= 500) {
    return new ApiError(
      status,
      'SERVICE_UNAVAILABLE',
      'El servicio no está disponible en este momento. Intenta de nuevo.',
    );
  }
  return new ApiError(status, 'HTTP_ERROR', 'Ocurrió un error inesperado.');
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, json, form, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined = form;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}${toQueryString(query)}`, {
      method,
      headers,
      body,
      signal,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.');
  }

  if (response.status === 204) return undefined as T;
  const payload = await readJson(response);
  if (!response.ok) {
    if (!isErrorBody(payload)) throw fallbackError(response.status);
    const { code, message, details } = payload.error;
    throw new ApiError(response.status, code, message, details);
  }
  if (payload === null) throw fallbackError(response.status);
  return payload as T;
}

export const http = {
  async get<T>(path: string, options?: { query?: Query; signal?: AbortSignal }): Promise<T> {
    return (await request<{ data: T }>(path, options)).data;
  },
  async page<T>(path: string, options?: { query?: Query; signal?: AbortSignal }): Promise<Page<T>> {
    const { data, meta } = await request<{ data: T[]; meta: PaginationMeta }>(path, options);
    return { items: data, meta };
  },
  async post<T>(path: string, json?: unknown): Promise<T> {
    return (await request<{ data: T } | undefined>(path, { method: 'POST', json }))?.data as T;
  },
  async patch<T>(path: string, json: unknown): Promise<T> {
    return (await request<{ data: T }>(path, { method: 'PATCH', json })).data;
  },
  async put<T>(path: string, form: FormData): Promise<T> {
    return (await request<{ data: T }>(path, { method: 'PUT', form })).data;
  },
  async delete(path: string): Promise<void> {
    await request<undefined>(path, { method: 'DELETE' });
  },
};
