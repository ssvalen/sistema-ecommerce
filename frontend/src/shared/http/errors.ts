import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from '@/shared/ui/toast';
import { ApiError } from './api-client';

const handled = new WeakSet<object>();

// Ya notificados por el manejador global.
export function markHandled(error: object): void {
  handled.add(error);
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
}

export function notifyError(error: unknown): void {
  if (typeof error === 'object' && error !== null && handled.has(error)) return;
  toast.error(errorMessage(error));
}

export function hasCode(error: unknown, ...codes: string[]): error is ApiError {
  return error instanceof ApiError && codes.includes(error.code);
}

export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!hasCode(error, 'VALIDATION_ERROR')) return false;
  let applied = false;
  for (const detail of error.details) {
    const field = fields.find((name) => name === detail.path);
    if (field && typeof detail.message === 'string') {
      setError(field, { type: 'server', message: detail.message });
      applied = true;
    }
  }
  return applied;
}
