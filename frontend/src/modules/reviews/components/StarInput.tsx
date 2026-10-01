import { faStar } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { cx } from '@/shared/lib/cx';

const LABELS = ['Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

interface StarInputProps {
  name: string;
  value: number | undefined;
  onChange: (value: number) => void;
  error?: string;
}

// Radios nativos: el teclado los recorre con las flechas.
export function StarInput({ name, value, onChange, error }: StarInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value ?? 0;

  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium text-slate-700">Calificación</legend>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHovered(null)}>
          {LABELS.map((label, index) => {
            const star = index + 1;
            return (
              <label
                key={star}
                onMouseEnter={() => setHovered(star)}
                className="cursor-pointer rounded-lg p-1 text-2xl has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-blue-600 pointer-coarse:p-2"
              >
                <input
                  type="radio"
                  name={name}
                  value={star}
                  checked={value === star}
                  onChange={() => onChange(star)}
                  aria-invalid={error ? true : undefined}
                  className="sr-only"
                />
                <FontAwesomeIcon
                  icon={faStar}
                  className={cx(
                    'transition-colors duration-150',
                    star <= shown ? 'text-amber-500' : 'text-slate-300',
                  )}
                />
                <span className="sr-only">
                  {star === 1 ? '1 estrella' : `${star} estrellas`}: {label}
                </span>
              </label>
            );
          })}
        </div>
        {shown > 0 && (
          <span aria-hidden="true" className="text-sm font-medium text-slate-700">
            {LABELS[shown - 1]}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
