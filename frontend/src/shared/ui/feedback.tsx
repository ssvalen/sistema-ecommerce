import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArrowLeft, faCircleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '@/shared/http/errors';
import { cx } from '@/shared/lib/cx';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded bg-slate-200', className)} />;
}

export function Spinner({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export type BadgeTone = 'blue' | 'green' | 'red' | 'amber' | 'slate';

const BADGE_TONES: Record<BadgeTone, string> = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-rose-50 text-rose-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function Badge({ tone = 'blue', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('panel p-5', className)}>{children}</div>;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-balance text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon: IconDefinition;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      <FontAwesomeIcon icon={icon} className="text-3xl text-slate-300" />
      <h2 className="text-lg font-semibold text-balance text-slate-900">{title}</h2>
      {message && <p className="max-w-md text-sm text-pretty text-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={faCircleExclamation}
      title="No se pudo cargar la información"
      message={errorMessage(error)}
      action={
        onRetry && (
          <Button color="gray" variant="soft" icon={faRotateRight} onClick={onRetry}>
            Reintentar
          </Button>
        )
      }
    />
  );
}

export function Alert({ tone, children }: { tone: 'red' | 'amber'; children: ReactNode }) {
  return (
    <div
      role="alert"
      className={cx(
        'flex gap-3 rounded-2xl border p-4 text-sm',
        tone === 'red'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-blue-700"
    >
      <FontAwesomeIcon icon={faArrowLeft} />
      {children}
    </Link>
  );
}
