import { faPenToSquare, faRotateRight, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { useSession } from '@/modules/identity';
import { errorMessage, notifyError } from '@/shared/http/errors';
import type { LoginState } from '@/shared/lib/login-state';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card, Skeleton } from '@/shared/ui/feedback';
import { ConfirmationModal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast';
import { useDeleteMyReview, useMyReview } from '../hooks';
import { ReviewForm } from './ReviewForm';
import { Stars } from './Stars';

const TITLE = 'font-semibold text-slate-900';

// Cliente: escribir, editar o eliminar su reseña. El admin modera desde la lista.
export function MyReviewPanel({ productId }: { productId: number }) {
  const { user } = useSession();
  const location = useLocation();
  const mine = useMyReview(productId, user?.role === 'CUSTOMER');
  const remove = useDeleteMyReview(productId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (user?.role === 'ADMIN') return null;

  if (!user) {
    const state: LoginState = { from: { pathname: location.pathname, search: location.search } };
    return (
      <Card className="space-y-3">
        <h3 className={TITLE}>¿Compraste este producto?</h3>
        <p className="text-sm text-muted">Inicia sesión para dejar tu reseña.</p>
        <ButtonLink to="/login" state={state} size="sm" color="gray" variant="soft">
          Iniciar sesión
        </ButtonLink>
      </Card>
    );
  }

  if (mine.isPending) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (mine.isError) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-danger">{errorMessage(mine.error)}</p>
        <Button
          size="sm"
          color="gray"
          variant="soft"
          icon={faRotateRight}
          onClick={() => void mine.refetch()}
        >
          Reintentar
        </Button>
      </Card>
    );
  }

  const { canReview, authorName, review } = mine.data;

  if (!canReview) {
    return (
      <Card className="space-y-2">
        <h3 className={TITLE}>Tu reseña</h3>
        <p className="text-sm text-muted">
          Podrás opinar cuando completes una compra de este producto.
        </p>
      </Card>
    );
  }

  if (!review || editing) {
    return (
      <Card className="space-y-4">
        <h3 className={TITLE}>{review ? 'Editar tu reseña' : 'Escribe tu reseña'}</h3>
        <ReviewForm
          productId={productId}
          authorName={authorName}
          review={review}
          onDone={() => setEditing(false)}
          onCancel={review ? () => setEditing(false) : undefined}
        />
      </Card>
    );
  }

  const confirmDelete = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success('Eliminaste tu reseña.');
        setConfirming(false);
      },
      onError: notifyError,
    });

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className={TITLE}>Tu reseña</h3>
        <Stars value={review.rating} />
      </div>
      {review.comment && (
        <p className="text-sm leading-relaxed whitespace-pre-line wrap-break-word text-slate-700">
          {review.comment}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          color="gray"
          variant="soft"
          icon={faPenToSquare}
          onClick={() => setEditing(true)}
        >
          Editar
        </Button>
        <Button
          size="sm"
          color="red"
          variant="soft"
          icon={faTrash}
          onClick={() => setConfirming(true)}
        >
          Eliminar
        </Button>
      </div>
      <ConfirmationModal
        open={confirming}
        title="Eliminar reseña"
        message="Tu reseña dejará de mostrarse. Puedes escribir otra cuando quieras."
        confirmText="Eliminar"
        confirmColor="red"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
