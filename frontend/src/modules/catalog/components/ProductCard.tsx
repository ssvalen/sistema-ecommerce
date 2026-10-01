import { faFire } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Product } from '@sistema-e/contracts';
import { Link } from 'react-router';
import { AddToCartButton } from '@/modules/cart';
import { CompactRating } from '@/modules/reviews';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { LOW_STOCK } from '@/shared/lib/stock';
import { Skeleton } from '@/shared/ui/feedback';
import { ProductImage } from '@/shared/ui/ProductImage';

export function UnitsSold({ units, className }: { units: number; className?: string }) {
  return (
    <span className={className}>
      <FontAwesomeIcon icon={faFire} className="mr-1.5 text-orange-600" />
      <span className="tabular-nums">{formatNumber(units)}</span> vendidos
    </span>
  );
}

interface ProductCardProps {
  product: Product;
  /** Puesto por unidades vendidas. */
  rank?: number;
}

export function ProductCard({ product, rank }: ProductCardProps) {
  const detail = `/products/${product.id}`;
  const soldOut = product.stock === 0;

  return (
    <article className="group panel flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lg">
      <Link to={detail} tabIndex={-1} aria-hidden="true" className="relative block overflow-hidden">
        <ProductImage
          src={product.imageUrl}
          alt=""
          className="aspect-square w-full transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
        />
        {rank !== undefined && (
          <span className="absolute top-3 left-3 rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-bold text-white tabular-nums">
            #{rank}
          </span>
        )}
        {soldOut && (
          <span className="absolute top-3 right-3 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
            Agotado
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={detail}>
          <h3 className="line-clamp-2 text-sm font-semibold wrap-break-word text-slate-900 group-hover:text-blue-700">
            {product.name}
          </h3>
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <p className="truncate text-muted">{product.category.name}</p>
          <CompactRating rating={product.rating} className="shrink-0 text-slate-700" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="text-lg font-bold text-slate-900 tabular-nums">
            {formatMoney(product.price)}
          </p>
          <UnitsSold units={product.unitsSold} className="text-xs font-medium text-slate-600" />
        </div>
        {!soldOut && product.stock <= LOW_STOCK && (
          <p className="mt-1 text-xs font-medium text-amber-800">
            {product.stock === 1 ? 'Queda 1 unidad' : `Quedan ${product.stock} unidades`}
          </p>
        )}
        <div className="mt-3">
          <AddToCartButton
            productId={product.id}
            productName={product.name}
            stock={product.stock}
            size="sm"
            variant="soft"
          />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="panel overflow-hidden">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}
