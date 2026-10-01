import type { RatingSummary } from '@sistema-e/contracts';
import { useId } from 'react';
import { formatRating } from '@/shared/lib/format';
import { Card } from '@/shared/ui/feedback';
import { MyReviewPanel } from './MyReviewPanel';
import { ReviewList } from './ReviewList';
import { reviewCount, Stars } from './Stars';

export const REVIEWS_ANCHOR = 'resenas';

function RatingOverview({ rating }: { rating: RatingSummary }) {
  if (rating.average === null) {
    return (
      <Card>
        <p className="text-sm text-muted">Este producto todavía no tiene calificaciones.</p>
      </Card>
    );
  }
  return (
    <Card className="flex items-center gap-4">
      <p aria-hidden="true" className="text-4xl font-bold text-slate-900 tabular-nums">
        {formatRating(rating.average)}
      </p>
      <div className="space-y-1">
        <Stars value={rating.average} size="lg" />
        <p className="text-sm text-muted">{reviewCount(rating.count)}</p>
      </div>
    </Card>
  );
}

export function ProductReviews({
  productId,
  rating,
}: {
  productId: number;
  rating: RatingSummary;
}) {
  const titleId = useId();
  return (
    <section id={REVIEWS_ANCHOR} aria-labelledby={titleId} className="scroll-mt-24 space-y-5">
      <div>
        <h2 id={titleId} className="text-xl font-bold text-balance text-slate-900">
          Reseñas
        </h2>
        <p className="mt-1 text-sm text-muted">
          Solo opinan los clientes que compraron el producto.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <RatingOverview rating={rating} />
          <MyReviewPanel productId={productId} />
        </div>
        <div className="lg:col-span-2">
          <ReviewList productId={productId} />
        </div>
      </div>
    </section>
  );
}
