import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';

const CONTROL =
  'w-full rounded-xl border bg-slate-50 px-4 text-sm text-slate-800 transition-colors duration-200 placeholder:text-muted focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted';

const controlState = (invalid: boolean | undefined) =>
  invalid
    ? 'border-rose-400 focus:border-rose-600'
    : 'border-slate-200 hover:border-slate-300 focus:border-blue-600';

type ControlProps<T extends 'input' | 'textarea' | 'select'> = ComponentProps<T> & {
  invalid?: boolean;
};

export function Input({ invalid, className, ...props }: ControlProps<'input'>) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, 'h-12', controlState(invalid), className)}
    />
  );
}

export function Textarea({ invalid, className, ...props }: ControlProps<'textarea'>) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, 'min-h-28 py-3', controlState(invalid), className)}
    />
  );
}

export function Select({ invalid, className, ...props }: ControlProps<'select'>) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, 'h-12', controlState(invalid), className)}
    />
  );
}

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="panel space-y-4 p-4">
      <legend className="px-2 text-sm font-semibold text-slate-700">{legend}</legend>
      {children}
    </fieldset>
  );
}
