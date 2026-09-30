import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Fragment } from 'react';
import { cx } from '@/shared/lib/cx';

const STEPS = ['Carrito', 'Pago', 'Confirmación'];

export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Pasos de la compra" className="flex items-center gap-3">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current || (step === 3 && current === 3);
        const active = step === current && !done;
        return (
          <Fragment key={label}>
            {index > 0 && (
              <li
                aria-hidden="true"
                className={cx(
                  'h-0.5 flex-1 rounded',
                  step <= current ? 'bg-accent' : 'bg-slate-200',
                )}
              />
            )}
            <li
              aria-current={step === current ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  done && 'bg-emerald-700 text-white',
                  active && 'bg-accent text-white',
                  !done && !active && 'bg-slate-200 text-slate-700',
                )}
              >
                {done ? <FontAwesomeIcon icon={faCheck} /> : step}
              </span>
              <span
                className={cx(
                  'hidden text-sm font-medium sm:inline',
                  step === current ? 'text-slate-900' : 'text-muted',
                )}
              >
                {label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
