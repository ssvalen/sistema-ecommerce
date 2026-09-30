import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ProductListQuery } from '@sistema-e/contracts';
import { Link, type To } from 'react-router';
import { useProducts } from '../hooks';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

interface ProductStripProps {
  title: string;
  /** Ordenada por popularidad. */
  query: ProductListQuery;
  seeAll: To;
  excludeId?: number;
}

const STRIP_SIZE = 4;

export function ProductStrip({ title, query, seeAll, excludeId }: ProductStripProps) {
  const products = useProducts(query);
  const items = products.data?.items
    .map((product, index) => ({ product, rank: index + 1 }))
    .filter(({ product }) => product.id !== excludeId)
    .slice(0, STRIP_SIZE);

  if (products.isError || items?.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold text-balance text-slate-900">{title}</h2>
        <Link
          to={seeAll}
          className="flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-700 underline-offset-4 hover:underline"
        >
          Ver todo
          <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {items
          ? items.map(({ product, rank }) => (
              <ProductCard key={product.id} product={product} rank={rank} />
            ))
          : Array.from({ length: STRIP_SIZE }, (_, index) => <ProductCardSkeleton key={index} />)}
      </div>
    </section>
  );
}
