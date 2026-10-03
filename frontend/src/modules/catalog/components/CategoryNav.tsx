import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { cx } from '@/shared/lib/cx';
import { useCategories } from '../hooks';

const PILL =
  'rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:py-2.5';

const ARROW =
  'absolute inset-y-0 z-10 flex w-12 items-center text-slate-600 hover:text-slate-900 pointer-coarse:w-14';

type Direction = -1 | 1;

// Conserva búsqueda, precio y orden.
export function CategoryNav({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const categories = useCategories();
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const onCatalog = pathname === '/';
  const activeId = onCatalog ? searchParams.get('categoryId') : null;

  // ResizeObserver también avisa al empezar a observar.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () =>
      setOverflow({
        start: element.scrollLeft > 4,
        end: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [categories.data]);

  useEffect(() => {
    scroller.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeId, categories.data]);

  const scroll = (direction: Direction) => {
    const element = scroller.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  const linkTo = (categoryId: number | null) => {
    const params = new URLSearchParams(onCatalog ? searchParams : undefined);
    params.delete('page');
    if (categoryId === null) params.delete('categoryId');
    else params.set('categoryId', String(categoryId));
    return { pathname: '/', search: params.toString() };
  };

  const pillClass = (active: boolean) =>
    cx(PILL, active ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100');

  return (
    <nav aria-label="Categorías" className={cx('bg-white', className)}>
      <div className="relative mx-auto max-w-7xl">
        {overflow.start && (
          <button
            type="button"
            aria-label="Ver categorías anteriores"
            onClick={() => scroll(-1)}
            className={cx(ARROW, 'left-0 justify-start bg-linear-to-r from-white from-60% pl-3')}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
        )}
        <div ref={scroller} className="scrollbar-none flex gap-1 overflow-x-auto px-4 py-2 md:px-6">
          <Link
            to={linkTo(null)}
            aria-current={onCatalog && !activeId ? 'page' : undefined}
            className={pillClass(onCatalog && !activeId)}
          >
            Todo
          </Link>
          {categories.data?.map((category) => {
            const active = activeId === String(category.id);
            return (
              <Link
                key={category.id}
                to={linkTo(category.id)}
                aria-current={active ? 'page' : undefined}
                className={pillClass(active)}
              >
                {category.name}
              </Link>
            );
          })}
        </div>
        {overflow.end && (
          <button
            type="button"
            aria-label="Ver más categorías"
            onClick={() => scroll(1)}
            className={cx(ARROW, 'right-0 justify-end bg-linear-to-l from-white from-60% pr-3')}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        )}
      </div>
    </nav>
  );
}
