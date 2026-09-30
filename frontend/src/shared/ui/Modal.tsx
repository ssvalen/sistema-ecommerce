import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Button, type ButtonColor } from './Button';

const SIZES = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' } as const;

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof SIZES;
}

export function Modal({ open, title, onClose, children, size = 'md' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative w-full animate-pop-in overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl',
          SIZES[size],
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 pointer-coarse:h-11 pointer-coarse:w-11"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto bg-white p-6">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  confirmColor?: ButtonColor;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  confirmColor = 'green',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <Modal open={open} title={title} onClose={loading ? () => {} : onCancel} size="sm">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-lg" />
          </div>
          <p className="pt-2 text-sm text-slate-500">{message}</p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button color="red" variant="outline" disabled={loading} onClick={onCancel}>
            Cancelar
          </Button>
          <Button color={confirmColor} loading={loading} onClick={onConfirm}>
            {loading ? 'Procesando...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
