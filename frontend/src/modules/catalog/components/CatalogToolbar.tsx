import { faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { useCategories } from '../hooks';
import { hasFilters, useCatalogParams } from '../product-query';
import { PriceFilter } from './PriceFilter';

interface Chip {
  key: string;
  label: string;
  remove: () => void;
}

const PRICE_FILTER_ID = 'price-filter';

export function CatalogToolbar({ total }: { total: number | undefined }) {
  const { searchParams, setFilters, clearFilters } = useCatalogParams();
  const categories = useCategories();
  const [priceOpen, setPriceOpen] = useState(false);

  const q = searchParams.get('q');
  const categoryId = searchParams.get('categoryId');
  const min = searchParams.get('minPrice');
  const max = searchParams.get('maxPrice');
  const categoryName = categories.data?.find((c) => String(c.id) === categoryId)?.name;

  const chips: Chip[] = [];
  if (q) chips.push({ key: 'q', label: `“${q}”`, remove: () => setFilters({ q: null }) });
  if (categoryId) {
    chips.push({
      key: 'category',
      label: categoryName ?? 'Categoría',
      remove: () => setFilters({ categoryId: null }),
    });
  }
  if (min || max) {
    const label =
      min && max
        ? `${formatMoney(min)} – ${formatMoney(max)}`
        : min
          ? `Desde ${formatMoney(min)}`
          : `Hasta ${formatMoney(max ?? 0)}`;
    chips.push({
      key: 'price',
      label,
      remove: () => setFilters({ minPrice: null, maxPrice: null }),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm text-muted tabular-nums">
          {total === undefined
            ? 'Buscando productos...'
            : `${formatNumber(total)} ${total === 1 ? 'producto' : 'productos'}`}
        </p>
        <button
          type="button"
          aria-expanded={priceOpen}
          aria-controls={PRICE_FILTER_ID}
          onClick={() => setPriceOpen((open) => !open)}
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 md:hidden pointer-coarse:h-11"
        >
          Precio
          <FontAwesomeIcon
            icon={faChevronDown}
            className={cx('text-xs transition-transform', priceOpen && 'rotate-180')}
          />
        </button>
        <div
          className={cx(
            'order-last w-full md:order-none md:block md:w-auto',
            priceOpen ? 'block' : 'hidden',
          )}
        >
          <PriceFilter id={PRICE_FILTER_ID} />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="catalog-sort" className="sr-only text-sm text-muted sm:not-sr-only">
            Ordenar por
          </label>
          <select
            id="catalog-sort"
            value={searchParams.get('sort') ?? 'newest'}
            onChange={(event) =>
              setFilters({ sort: event.target.value === 'newest' ? null : event.target.value })
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-600 pointer-coarse:h-11"
          >
            <option value="newest">Más recientes</option>
            <option value="popularity">Más vendidos</option>
          </select>
        </div>
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={chip.remove}
                aria-label={`Quitar filtro ${chip.label}`}
                className="flex items-center gap-2 rounded-full border border-cyan-100 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 pointer-coarse:py-2.5"
              >
                {chip.label}
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </li>
          ))}
          {hasFilters(searchParams) && chips.length > 1 && (
            <li>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900 pointer-coarse:py-2.5"
              >
                Limpiar todo
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
