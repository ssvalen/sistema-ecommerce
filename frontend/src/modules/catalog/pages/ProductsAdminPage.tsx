import {
  faEye,
  faFilterCircleXmark,
  faPenToSquare,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import type { Product } from '@sistema-e/contracts';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { notifyError } from '@/shared/http/errors';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Badge, EmptyState, ErrorState, PageHeader } from '@/shared/ui/feedback';
import { ConfirmationModal } from '@/shared/ui/Modal';
import { ProductImage } from '@/shared/ui/ProductImage';
import { toast } from '@/shared/ui/toast';
import { CatalogFilters } from '../components/CatalogFilters';
import { useDeleteProduct, useProducts } from '../hooks';
import { parseProductQuery } from '../product-query';

const PAGE_SIZE = 20;

export function ProductsAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = parseProductQuery(searchParams, PAGE_SIZE);
  const products = useProducts(parsed.success ? parsed.data : null);
  const deleteProduct = useDeleteProduct();
  const [target, setTarget] = useState<Product | null>(null);

  const setPage = (page: number) =>
    setSearchParams((params) => {
      params.set('page', String(page));
      return params;
    });

  const confirmDelete = () => {
    if (!target) return;
    deleteProduct.mutate(target.id, {
      onSuccess: () => {
        toast.success(`Se eliminó ${target.name}.`);
        setTarget(null);
      },
      onError: notifyError,
    });
  };

  const columns: Column<Product>[] = [
    {
      header: 'Producto',
      cell: (product) => (
        <div className="flex min-w-56 items-center gap-3">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="h-12 w-12 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <p className="line-clamp-2 font-medium text-slate-800">{product.name}</p>
            <p className="text-xs text-muted">#{product.id}</p>
          </div>
        </div>
      ),
    },
    { header: 'Categoría', cell: (product) => <Badge>{product.category.name}</Badge> },
    {
      header: 'Precio',
      cell: (product) => formatMoney(product.price),
      className: 'whitespace-nowrap text-right',
    },
    {
      header: 'Stock',
      cell: (product) =>
        product.stock === 0 ? <Badge tone="red">Agotado</Badge> : formatNumber(product.stock),
      className: 'text-right',
    },
    {
      header: 'Vendidos',
      cell: (product) => formatNumber(product.unitsSold),
      className: 'text-right',
    },
    {
      header: 'Acciones',
      cell: (product) => (
        <div className="flex gap-2">
          <ButtonLink
            to={`/products/${product.id}`}
            size="sm"
            color="gray"
            variant="soft"
            icon={faEye}
            title="Ver en el catálogo"
            aria-label={`Ver ${product.name} en el catálogo`}
          />
          <ButtonLink
            to={`/admin/products/${product.id}/edit`}
            size="sm"
            variant="soft"
            icon={faPenToSquare}
            title="Editar"
            aria-label={`Editar ${product.name}`}
          />
          <Button
            size="sm"
            color="red"
            variant="soft"
            icon={faTrash}
            title="Eliminar"
            aria-label={`Eliminar ${product.name}`}
            onClick={() => setTarget(product)}
          />
        </div>
      ),
    },
  ];

  let content;
  if (!parsed.success) {
    content = (
      <EmptyState
        icon={faFilterCircleXmark}
        title="Los filtros no son válidos"
        message={parsed.error.issues[0]?.message}
        action={
          <Button onClick={() => setSearchParams(new URLSearchParams())}>Limpiar filtros</Button>
        }
      />
    );
  } else if (products.isError) {
    content = <ErrorState error={products.error} onRetry={() => void products.refetch()} />;
  } else {
    content = (
      <DataTable
        columns={columns}
        rows={products.data?.items}
        rowKey={(product) => product.id}
        loading={products.isFetching}
        emptyMessage="No hay productos que coincidan con los filtros."
        pagination={
          products.data && {
            page: products.data.meta.page,
            totalPages: products.data.meta.totalPages,
            total: products.data.meta.total,
            onPageChange: setPage,
          }
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        subtitle="Crea, edita y elimina los productos del catálogo."
        actions={
          <ButtonLink to="/admin/products/new" icon={faPlus}>
            Nuevo producto
          </ButtonLink>
        }
      />
      <CatalogFilters />
      {content}
      <ConfirmationModal
        open={target !== null}
        title="Eliminar producto"
        message={`${target?.name} dejará de mostrarse en el catálogo y se quitará de los carritos. Los pedidos existentes no cambian.`}
        confirmText="Eliminar"
        confirmColor="red"
        loading={deleteProduct.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
