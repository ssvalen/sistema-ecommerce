import { Link, useLocation, useSearchParams } from 'react-router';
import { cx } from '@/shared/lib/cx';
import { useCategories } from '../hooks';

const PILL =
  'rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:py-2.5';

// Conserva búsqueda, precio y orden.
export function CategoryNav({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const categories = useCategories();
  const onCatalog = pathname === '/';
  const activeId = onCatalog ? searchParams.get('categoryId') : null;

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
      <div className="scrollbar-none mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 md:px-6">
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
    </nav>
  );
}
