import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Product, ProductListQuery } from '@sistema-e/contracts';
import { Link } from 'react-router';
import { AddToCartButton } from '@/modules/cart';
import { formatMoney } from '@/shared/lib/format';
import { ProductImage } from '@/shared/ui/ProductImage';
import { useProducts } from '../hooks';
import { UnitsSold } from './ProductCard';

const TOP: ProductListQuery = { page: 1, pageSize: 4, q: undefined, sort: 'popularity' };
const RANKING = { pathname: '/', search: '?sort=popularity' };

function Leader({ product }: { product: Product }) {
  const detail = `/products/${product.id}`;
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center">
      <Link to={detail} tabIndex={-1} aria-hidden="true" className="relative block">
        <ProductImage
          src={product.imageUrl}
          alt=""
          className="aspect-square w-full rounded-2xl bg-white"
        />
        <span className="absolute -top-3 -left-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl font-black text-blue-700 shadow-lg tabular-nums">
          1
        </span>
      </Link>
      <div className="min-w-0 space-y-3">
        <Link to={detail} className="block">
          <h2 className="text-2xl leading-tight font-bold text-balance wrap-break-word hover:underline hover:underline-offset-4">
            {product.name}
          </h2>
        </Link>
        <p className="text-sm text-blue-50">
          {product.category.name} ·{' '}
          <UnitsSold units={product.unitsSold} className="font-semibold text-white" />
        </p>
        <p className="text-3xl font-bold tabular-nums">{formatMoney(product.price)}</p>
        <div className="max-w-xs">
          <AddToCartButton
            productId={product.id}
            productName={product.name}
            stock={product.stock}
            variant="outline"
          />
        </div>
      </div>
    </div>
  );
}

function RunnerUp({ product, rank }: { product: Product; rank: number }) {
  return (
    <li>
      <Link
        to={`/products/${product.id}`}
        className="flex items-center gap-4 rounded-2xl bg-white p-3 text-slate-900 transition-shadow hover:shadow-lg"
      >
        <span className="w-8 shrink-0 text-center text-2xl font-black text-accent tabular-nums">
          {rank}
        </span>
        <ProductImage
          src={product.imageUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl border border-slate-100"
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-semibold wrap-break-word">{product.name}</span>
          <UnitsSold units={product.unitsSold} className="mt-1 block text-xs text-slate-600" />
        </span>
        <span className="shrink-0 font-bold tabular-nums">{formatMoney(product.price)}</span>
      </Link>
    </li>
  );
}

export function BestSellers() {
  const products = useProducts(TOP);
  const items = products.data?.items;

  if (products.isError || items?.length === 0) return null;

  return (
    <section
      aria-labelledby="best-sellers-title"
      data-surface="dark"
      className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white md:p-10"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="best-sellers-title" className="text-3xl font-bold text-balance md:text-4xl">
            Los más vendidos
          </h1>
          <p className="mt-2 text-blue-50">El ranking de la tienda, por unidades vendidas.</p>
        </div>
        <Link
          to={RANKING}
          className="flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
        >
          Ver el ranking completo
          <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
        </Link>
      </div>

      {items ? (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          {items[0] && <Leader product={items[0]} />}
          {items.length > 1 && (
            <ol className="space-y-3">
              {items.slice(1).map((product, index) => (
                <RunnerUp key={product.id} product={product} rank={index + 2} />
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="h-56 animate-pulse rounded-2xl bg-white/20" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-22 animate-pulse rounded-2xl bg-white/20" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
