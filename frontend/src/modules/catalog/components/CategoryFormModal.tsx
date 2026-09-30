import { zodResolver } from '@hookform/resolvers/zod';
import {
  CategoryCreateBodySchema,
  type Category,
  type CategoryUpdateBody,
} from '@sistema-e/contracts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { applyFieldErrors, hasCode, notifyError } from '@/shared/http/errors';
import { Button } from '@/shared/ui/Button';
import { FormField, Input, Textarea } from '@/shared/ui/form';
import { Modal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast';
import { useCreateCategory, useUpdateCategory } from '../hooks';

// El formulario usa '' para "sin descripción"; el contrato espera null.
const CategoryFormSchema = CategoryCreateBodySchema.extend({
  description: z.string().trim().max(500),
});
type CategoryForm = z.infer<typeof CategoryFormSchema>;

interface CategoryFormModalProps {
  category: Category | null;
  onClose: () => void;
}

function CategoryFormContent({ category, onClose }: CategoryFormModalProps) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<CategoryForm>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: { name: category?.name ?? '', description: category?.description ?? '' },
  });

  const onError = (error: unknown) => {
    if (hasCode(error, 'CATEGORY_NAME_TAKEN')) {
      setError('name', { type: 'server', message: error.message });
    } else if (!applyFieldErrors(error, setError, ['name', 'description'])) {
      notifyError(error);
    }
  };

  const onSubmit = handleSubmit(({ name, description }) => {
    const body = { name, description: description || null };
    if (!category) {
      create.mutate(body, {
        onSuccess: () => {
          toast.success('Categoría creada.');
          onClose();
        },
        onError,
      });
      return;
    }
    const patch: CategoryUpdateBody = {};
    if (dirtyFields.name) patch.name = body.name;
    if (dirtyFields.description) patch.description = body.description;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { id: category.id, body: patch },
      {
        onSuccess: () => {
          toast.success('Categoría actualizada.');
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-5">
      <FormField label="Nombre" htmlFor="category-name" error={errors.name?.message}>
        <Input id="category-name" maxLength={80} invalid={!!errors.name} {...register('name')} />
      </FormField>
      <FormField
        label="Descripción (opcional)"
        htmlFor="category-description"
        error={errors.description?.message}
      >
        <Textarea
          id="category-description"
          rows={3}
          maxLength={500}
          invalid={!!errors.description}
          {...register('description')}
        />
      </FormField>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button color="gray" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {category ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  );
}

export function CategoryFormModal({
  open,
  category,
  onClose,
}: CategoryFormModalProps & { open: boolean }) {
  return (
    <Modal
      open={open}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      onClose={onClose}
      size="sm"
    >
      {/* Remonta en cada apertura. */}
      {open && (
        <CategoryFormContent key={category?.id ?? 'new'} category={category} onClose={onClose} />
      )}
    </Modal>
  );
}
