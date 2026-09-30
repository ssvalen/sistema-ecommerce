import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cx } from '@/shared/lib/cx';
import { formatNumber } from '@/shared/lib/format';

function pageItems(page: number, last: number): (number | 'gap')[] {
  const pages = [...new Set([1, page - 1, page, page + 1, last])]
    .filter((item) => item >= 1 && item <= last)
    .sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  let previous = 0;
  for (const item of pages) {
    if (item - previous > 1) items.push('gap');
    items.push(item);
    previous = item;
  }
  return items;
}

const ITEM =
  'flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold tabular-nums transition pointer-coarse:h-11 pointer-coarse:min-w-11';

interface PageNavProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageNav({ page, totalPages, onPageChange }: PageNavProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cx(ITEM, 'text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-40')}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      {pageItems(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onPageChange(item)}
            className={cx(
              ITEM,
              item === page
                ? 'bg-accent text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:shadow-sm',
            )}
          >
            {formatNumber(item)}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Página siguiente"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={cx(ITEM, 'text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-40')}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </nav>
  );
}
