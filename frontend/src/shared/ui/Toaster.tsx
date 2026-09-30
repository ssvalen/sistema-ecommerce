import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router';
import { cx } from '@/shared/lib/cx';
import { dismissToast, useToasts, type ToastKind } from './toast';

const STYLES: Record<ToastKind, { color: string; icon: IconDefinition }> = {
  success: { color: 'bg-emerald-700', icon: faCircleCheck },
  error: { color: 'bg-rose-700', icon: faCircleExclamation },
  info: { color: 'bg-slate-800', icon: faCircleInfo },
};

export function Toaster() {
  const toasts = useToasts();

  return (
    <div
      aria-live="polite"
      data-surface="dark"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[400] flex flex-col items-stretch gap-2 sm:top-6 sm:right-6 sm:bottom-auto sm:left-auto sm:items-end"
    >
      {toasts.map(({ id, kind, message, action }) => {
        const style = STYLES[kind];
        return (
          <div
            key={id}
            role={kind === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto flex animate-slide-in items-center gap-3 rounded-2xl py-3 pr-2 pl-4 text-white shadow-xl sm:w-96',
              style.color,
            )}
          >
            <FontAwesomeIcon icon={style.icon} className="shrink-0" />
            <p className="flex-1 text-sm leading-snug font-semibold">{message}</p>
            {action && (
              <Link
                to={action.to}
                onClick={() => dismissToast(id)}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold underline underline-offset-4 hover:bg-white/15"
              >
                {action.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => dismissToast(id)}
              aria-label="Cerrar aviso"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/15 pointer-coarse:h-11 pointer-coarse:w-11"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
