import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}

const STEP_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11';

export function QuantityStepper({
  value,
  max,
  onChange,
  disabled = false,
  label = 'Cantidad',
}: QuantityStepperProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      <button
        type="button"
        aria-label="Disminuir"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
        className={STEP_BUTTON}
      >
        <FontAwesomeIcon icon={faMinus} className="text-xs" />
      </button>
      <span
        aria-live="polite"
        className="min-w-8 text-center text-sm font-semibold text-slate-900 tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className={STEP_BUTTON}
      >
        <FontAwesomeIcon icon={faPlus} className="text-xs" />
      </button>
    </div>
  );
}
