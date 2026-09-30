import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  to: string;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

const DURATION_MS: Record<ToastKind, number> = { success: 4000, error: 6000, info: 4000 };
const MAX_VISIBLE = 3;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, action?: ToastAction): void {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message, action }].slice(-MAX_VISIBLE);
  emit();
  setTimeout(() => dismissToast(id), DURATION_MS[kind]);
}

export const toast = {
  success: (message: string, action?: ToastAction) => push('success', message, action),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, () => toasts);
}
