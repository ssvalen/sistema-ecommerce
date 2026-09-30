import { faBoxOpen, faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons';
import { cx } from '@/shared/lib/cx';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState } from '@/shared/ui/feedback';
import { PageNav } from '@/shared/ui/PageNav';
import { BestSellers } from '../components/BestSellers';
import { CatalogToolbar } from '../components/CatalogToolbar';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { useCategories, useProducts } from '../hooks';
import { hasFilters, parseProductQuery, useCatalogParams } from '../product-query';

const PAGE_SIZE = 12;
const GRID = 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6 xl:grid-cols-4';

export function CatalogPage() {
  const { searchParams, setPage, clearFilters } = useCatalogParams();
  const parsed = parseProductQuery(searchParams, PAGE_SIZE);
  const query = parsed.success ? parsed.data : null;
  const products = useProducts(query);
  const categories = useCategories();

  const isHome = !hasFilters(searchParams) && !searchParams.has('page');
  const byPopularity = query?.sort === 'popularity';
  const categoryName = categories.data?.find((c) => c.id === query?.categoryId)?.name;
  const title = query?.q
    ? `Resultados para “${query.q}”`
    : (categoryName ?? (byPopularity ? 'Más vendidos' : 'Todos los productos'));
  const Heading = isHome ? 'h2' : 'h1';

  let content;
  if (!query) {
    content = (
      <EmptyState
        icon={faFilterCircleXmark}
        title="Los filtros no son válidos"
        message={parsed.error?.issues[0]?.message}
        action={<Button onClick={clearFilters}>Limpiar filtros</Button>}
      />
    );
  } else if (products.isError) {
    content = <ErrorState error={products.error} onRetry={() => void products.refetch()} />;
  } else if (!products.data) {
    content = (
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  } else if (products.data.items.length === 0) {
    content = (
      <EmptyState
        icon={faBoxOpen}
        title="No encontramos productos"
        message="Prueba con otra búsqueda, otra categoría o un rango de precio más amplio."
        action={
          hasFilters(searchParams) && (
            <Button color="gray" variant="soft" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )
        }
      />
    );
  } else {
    const { items, meta } = products.data;
    const firstRank = (meta.page - 1) * meta.pageSize + 1;
    content = (
      <>
        <div className={cx(GRID, 'transition-opacity', products.isPlaceholderData && 'opacity-60')}>
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              rank={byPopularity ? firstRank + index : undefined}
            />
          ))}
        </div>
        <PageNav page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
      </>
    );
  }

  return (
    <div className="space-y-10">
      {isHome && <BestSellers />}
      <section className="space-y-5">
        <Heading className="text-2xl font-bold text-balance text-slate-900">{title}</Heading>
        <CatalogToolbar total={products.data?.meta.total} />
        {content}
      </section>
    </div>
  );
}
