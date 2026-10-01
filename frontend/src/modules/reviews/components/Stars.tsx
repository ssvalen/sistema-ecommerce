import { faStar, faStarHalfStroke } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { RatingSummary } from '@sistema-e/contracts';
import { cx } from '@/shared/lib/cx';
import { formatNumber, formatRating } from '@/shared/lib/format';

const SIZES = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' } as const;
const STARS = [1, 2, 3, 4, 5];

export const ratingLabel = (value: number) => `${formatRating(value)} de 5 estrellas`;

// Redondea a media estrella.
export function Stars({ value, size = 'md' }: { value: number; size?: keyof typeof SIZES }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      role="img"
      aria-label={ratingLabel(value)}
      className={cx('inline-flex gap-0.5', SIZES[size])}
    >
      {STARS.map((star) => (
        <FontAwesomeIcon
          key={star}
          icon={rounded === star - 0.5 ? faStarHalfStroke : faStar}
          className={rounded >= star - 0.5 ? 'text-amber-500' : 'text-slate-300'}
        />
      ))}
    </span>
  );
}

export const reviewCount = (count: number) =>
  `${formatNumber(count)} ${count === 1 ? 'reseña' : 'reseñas'}`;

// Para tarjetas y encabezados: una estrella, el promedio y la cantidad.
export function CompactRating({
  rating,
  className,
}: {
  rating: RatingSummary;
  className?: string;
}) {
  if (rating.average === null) return null;
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      <FontAwesomeIcon icon={faStar} className="text-amber-500" />
      <span className="sr-only">
        {ratingLabel(rating.average)}, {reviewCount(rating.count)}
      </span>
      <span aria-hidden="true" className="font-semibold tabular-nums">
        {formatRating(rating.average)}
      </span>
      <span aria-hidden="true" className="text-muted tabular-nums">
        ({formatNumber(rating.count)})
      </span>
    </span>
  );
}
