import { faBoxOpen } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import { hasCode } from '@/shared/http/errors';
import { BackLink, EmptyState, ErrorState, PageHeader, Spinner } from '@/shared/ui/feedback';
import { ProductForm } from '../components/ProductForm';
import { useProduct } from '../hooks';
import { parseId } from '../product-query';

export function ProductEditorPage() {
  const params = useParams();
  const isNew = params.id === undefined;
  const id = isNew ? null : parseId(params.id);
  const product = useProduct(id);

  const back = <BackLink to="/admin/products">Productos</BackLink>;

  if (isNew) {
    return (
      <div className="space-y-6">
        {back}
        <PageHeader
          title="Nuevo producto"
          subtitle="Completa los datos para publicarlo en el catálogo."
        />
        <ProductForm product={null} />
      </div>
    );
  }

  if (id === null || hasCode(product.error, 'NOT_FOUND')) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={faBoxOpen}
          title="Producto no encontrado"
          message="El producto no existe o fue eliminado."
        />
      </div>
    );
  }
  if (product.isPending) return <Spinner label="Cargando producto..." />;
  if (product.isError) {
    return <ErrorState error={product.error} onRetry={() => void product.refetch()} />;
  }

  return (
    <div className="space-y-6">
      {back}
      <PageHeader title="Editar producto" subtitle={product.data.name} />
      <ProductForm key={product.data.id} product={product.data} />
    </div>
  );
}
