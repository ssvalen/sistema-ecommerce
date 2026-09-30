import {
  faBoxOpen,
  faChevronRight,
  faCircleCheck,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Product } from '@sistema-e/contracts';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AddToCartButton } from '@/modules/cart';
import { useSession } from '@/modules/identity';
import { hasCode } from '@/shared/http/errors';
import { cx } from '@/shared/lib/cx';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { LOW_STOCK } from '@/shared/lib/stock';
import { ButtonLink } from '@/shared/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/feedback';
import { ProductImage } from '@/shared/ui/ProductImage';
import { QuantityStepper } from '@/shared/ui/QuantityStepper';
import { UnitsSold } from '../components/ProductCard';
import { ProductStrip } from '../components/ProductStrip';
import { useProduct } from '../hooks';
import { parseId } from '../product-query';

const MAX_QUANTITY = 1000;

const categoryLink = (product: Product) => ({
  pathname: '/',
  search: `?categoryId=${product.category.id}`,
});

function StockPill({ stock }: { stock: number }) {
  const [tone, text] =
    stock === 0
      ? ['bg-rose-50 text-rose-700', 'Agotado']
      : stock <= LOW_STOCK
        ? [
            'bg-amber-50 text-amber-800',
            stock === 1 ? 'Queda 1 unidad' : `Quedan ${stock} unidades`,
          ]
        : ['bg-emerald-50 text-emerald-700', `En stock · ${formatNumber(stock)} disponibles`];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
        tone,
      )}
    >
      {stock > 0 && <FontAwesomeIcon icon={faCircleCheck} />}
      {text}
    </span>
  );
}

function PurchaseBox({ product }: { product: Product }) {
  const { user } = useSession();
  const [quantity, setQuantity] = useState(1);
  const max = Math.max(Math.min(product.stock, MAX_QUANTITY), 1);

  if (user?.role === 'ADMIN') {
    return (
      <ButtonLink
        to={`/admin/products/${product.id}/edit`}
        color="gray"
        variant="soft"
        icon={faPenToSquare}
      >
        Editar producto
      </ButtonLink>
    );
  }

  return (
    <div className="space-y-4">
      {user && product.stock > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Cantidad</span>
          <QuantityStepper value={Math.min(quantity, max)} max={max} onChange={setQuantity} />
        </div>
      )}
      <AddToCartButton
        productId={product.id}
        productName={product.name}
        stock={product.stock}
        quantity={Math.min(quantity, max)}
      />
      {!user && product.stock > 0 && (
        <p className="text-center text-sm text-muted">
          Te pediremos iniciar sesión y lo agregamos a tu carrito.
        </p>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <Skeleton className="aspect-square w-full rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ProductDetailPage() {
  const params = useParams();
  const id = parseId(params.id);
  const product = useProduct(id);

  if (id === null || hasCode(product.error, 'NOT_FOUND')) {
    return (
      <EmptyState
        icon={faBoxOpen}
        title="Producto no encontrado"
        message="El producto no existe o ya no está disponible."
        action={<ButtonLink to="/">Volver a la tienda</ButtonLink>}
      />
    );
  }
  if (product.isPending) return <DetailSkeleton />;
  if (product.isError) {
    return <ErrorState error={product.error} onRetry={() => void product.refetch()} />;
  }

  const { data } = product;
  return (
    <div className="space-y-12">
      <nav aria-label="Ruta" className="flex min-w-0 items-center gap-2 text-sm text-muted">
        <Link to="/" className="shrink-0 hover:text-blue-700">
          Inicio
        </Link>
        <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-slate-300" />
        <Link to={categoryLink(data)} className="shrink-0 hover:text-blue-700">
          {data.category.name}
        </Link>
        <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-slate-300" />
        <span className="truncate text-slate-700">{data.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="panel overflow-hidden">
          <ProductImage
            src={data.imageUrl}
            alt={data.name}
            priority
            className="aspect-square w-full"
          />
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl leading-tight font-bold text-balance wrap-break-word text-slate-900">
              {data.name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link
                to={categoryLink(data)}
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                {data.category.name}
              </Link>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <UnitsSold units={data.unitsSold} className="font-semibold text-slate-700" />
            </p>
          </div>

          <div className="space-y-3 border-y border-slate-200 py-6">
            <p className="text-4xl font-bold text-slate-900 tabular-nums">
              {formatMoney(data.price)}
            </p>
            <StockPill stock={data.stock} />
          </div>

          <PurchaseBox product={data} />

          {data.description && (
            <div className="panel p-5">
              <h2 className="mb-2 font-semibold text-slate-900">Descripción</h2>
              <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-slate-700">
                {data.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <ProductStrip
        title={`Más de ${data.category.name}`}
        query={{
          page: 1,
          pageSize: 5,
          q: undefined,
          sort: 'popularity',
          categoryId: data.category.id,
        }}
        seeAll={categoryLink(data)}
        excludeId={data.id}
      />
    </div>
  );
}
