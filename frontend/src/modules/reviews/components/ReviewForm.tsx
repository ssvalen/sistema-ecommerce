import { zodResolver } from '@hookform/resolvers/zod';
import { ReviewBodySchema, type Review } from '@sistema-e/contracts';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { applyFieldErrors, notifyError } from '@/shared/http/errors';
import { Button } from '@/shared/ui/Button';
import { FormField, Textarea } from '@/shared/ui/form';
import { toast } from '@/shared/ui/toast';
import { useSaveReview } from '../hooks';
import { StarInput } from './StarInput';

const COMMENT_MAX = 1000;

// El formulario usa '' para "sin comentario"; el contrato espera null.
const ReviewFormSchema = ReviewBodySchema.extend({
  comment: z.string().trim().max(COMMENT_MAX),
});
type ReviewForm = z.infer<typeof ReviewFormSchema>;

interface ReviewFormProps {
  productId: number;
  authorName: string;
  review: Review | null;
  onDone: () => void;
  onCancel?: () => void;
}

export function ReviewForm({ productId, authorName, review, onDone, onCancel }: ReviewFormProps) {
  const commentId = useId();
  const save = useSaveReview(productId);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReviewForm>({
    resolver: zodResolver(ReviewFormSchema),
    defaultValues: { rating: review?.rating, comment: review?.comment ?? '' },
  });

  const onSubmit = handleSubmit(({ rating, comment }) => {
    save.mutate(
      { rating, comment: comment || null },
      {
        onSuccess: () => {
          toast.success(review ? 'Actualizaste tu reseña.' : 'Gracias por tu reseña.');
          onDone();
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError, ['rating', 'comment'])) notifyError(error);
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <Controller
        control={control}
        name="rating"
        render={({ field, fieldState }) => (
          <StarInput
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <FormField
        label="Comentario (opcional)"
        htmlFor={commentId}
        error={errors.comment?.message}
        hint={`Se publicará como «${authorName}».`}
      >
        <Textarea
          id={commentId}
          rows={4}
          maxLength={COMMENT_MAX}
          invalid={!!errors.comment}
          {...register('comment')}
        />
      </FormField>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button color="gray" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={save.isPending}>
          {review ? 'Guardar cambios' : 'Publicar reseña'}
        </Button>
      </div>
    </form>
  );
}
