import { faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Review } from '@sistema-e/contracts';
import { useState } from 'react';
import { useSession } from '@/modules/identity';
import { notifyError } from '@/shared/http/errors';
import { cx } from '@/shared/lib/cx';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card, ErrorState, Skeleton } from '@/shared/ui/feedback';
import { ConfirmationModal } from '@/shared/ui/Modal';
import { PageNav } from '@/shared/ui/PageNav';
import { toast } from '@/shared/ui/toast';
import { useDeleteReview, useReviews } from '../hooks';
import { Stars } from './Stars';

function ReviewItem({ review, onDelete }: { review: Review; onDelete?: () => void }) {
  return (
    <li className="space-y-2 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} size="sm" />
        <span className="text-sm font-semibold text-slate-900">{review.authorName}</span>
        <span className="text-xs text-muted">{formatDate(review.createdAt)}</span>
        {onDelete && (
          <Button
            size="sm"
            color="red"
            variant="outline"
            icon={faTrash}
            onClick={onDelete}
            className="ml-auto"
          >
            Eliminar
          </Button>
        )}
      </div>
      {review.comment && (
        <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line wrap-break-word text-slate-700">
          {review.comment}
        </p>
      )}
    </li>
  );
}

export function ReviewList({ productId }: { productId: number }) {
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const reviews = useReviews(productId, page);
  const remove = useDeleteReview(productId);
  const [deleting, setDeleting] = useState<Review | null>(null);
  const isAdmin = user?.role === 'ADMIN';

  if (reviews.isError) {
    return <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />;
  }
  if (!reviews.data) {
    return (
      <Card className="space-y-6">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </Card>
    );
  }
  if (reviews.data.meta.total === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">Todavía no hay reseñas de este producto.</p>
      </Card>
    );
  }

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Reseña eliminada.');
        setDeleting(null);
      },
      onError: notifyError,
    });
  };

  return (
    <Card className="space-y-5 sm:p-6">
      <ul className={cx('divide-y divide-slate-100', reviews.isPlaceholderData && 'opacity-60')}>
        {reviews.data.items.length === 0 && (
          <li className="text-sm text-muted">No hay reseñas en esta página.</li>
        )}
        {reviews.data.items.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            onDelete={isAdmin ? () => setDeleting(review) : undefined}
          />
        ))}
      </ul>
      <PageNav page={page} totalPages={reviews.data.meta.totalPages} onPageChange={setPage} />
      <ConfirmationModal
        open={deleting !== null}
        title="Eliminar reseña"
        message={`Se eliminará la reseña de ${deleting?.authorName ?? ''}. No se puede deshacer.`}
        confirmText="Eliminar"
        confirmColor="red"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}
