import { faPenToSquare, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Category } from '@sistema-e/contracts';
import { useState } from 'react';
import { notifyError } from '@/shared/http/errors';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ErrorState, PageHeader } from '@/shared/ui/feedback';
import { ConfirmationModal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast';
import { CategoryFormModal } from '../components/CategoryFormModal';
import { useCategories, useDeleteCategory } from '../hooks';

type Editing = { category: Category | null } | null;

export function CategoriesAdminPage() {
  const categories = useCategories();
  const deleteCategory = useDeleteCategory();
  const [editing, setEditing] = useState<Editing>(null);
  const [target, setTarget] = useState<Category | null>(null);

  const confirmDelete = () => {
    if (!target) return;
    deleteCategory.mutate(target.id, {
      onSuccess: () => {
        toast.success(`Se eliminó la categoría ${target.name}.`);
        setTarget(null);
      },
      onError: (error) => {
        notifyError(error);
        setTarget(null);
      },
    });
  };

  const columns: Column<Category>[] = [
    {
      header: 'Nombre',
      cell: (category) => <span className="font-medium text-slate-800">{category.name}</span>,
    },
    {
      header: 'Descripción',
      cell: (category) =>
        category.description ? (
          <span className="line-clamp-2 text-slate-600">{category.description}</span>
        ) : (
          <span className="text-muted">Sin descripción</span>
        ),
    },
    {
      header: 'Acciones',
      className: 'w-40',
      cell: (category) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="soft"
            icon={faPenToSquare}
            title="Editar"
            aria-label={`Editar ${category.name}`}
            onClick={() => setEditing({ category })}
          />
          <Button
            size="sm"
            color="red"
            variant="soft"
            icon={faTrash}
            title="Eliminar"
            aria-label={`Eliminar ${category.name}`}
            onClick={() => setTarget(category)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        subtitle="Organiza los productos del catálogo."
        actions={
          <Button icon={faPlus} onClick={() => setEditing({ category: null })}>
            Nueva categoría
          </Button>
        }
      />
      {categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={categories.data}
          rowKey={(category) => category.id}
          loading={categories.isFetching}
          emptyMessage="Todavía no hay categorías."
        />
      )}
      <CategoryFormModal
        open={editing !== null}
        category={editing?.category ?? null}
        onClose={() => setEditing(null)}
      />
      <ConfirmationModal
        open={target !== null}
        title="Eliminar categoría"
        message={`¿Eliminar la categoría ${target?.name}? Solo se puede eliminar si no tiene productos.`}
        confirmText="Eliminar"
        confirmColor="red"
        loading={deleteCategory.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
