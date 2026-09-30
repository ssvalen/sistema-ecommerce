import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/shared/ui/Button';
import { Alert, Card } from '@/shared/ui/feedback';
import { Input, Select } from '@/shared/ui/form';
import { useCategories } from '../hooks';
import { FILTER_KEYS } from '../product-query';

const LABEL = 'mb-1 block text-xs text-slate-500';

// Los <select> envían el formulario al cambiar.
export function CatalogFilters({ showSort = true }: { showSort?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const categories = useCategories();
  const [error, setError] = useState<string | null>(null);

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const entry = data.get(key);
      const value = typeof entry === 'string' ? entry.trim() : '';
      if (value) next.set(key, value);
    }
    if (next.get('sort') === 'newest') next.delete('sort');

    const min = next.get('minPrice');
    const max = next.get('maxPrice');
    if (min && max && Number(min) > Number(max)) {
      setError('El precio mínimo no puede ser mayor que el máximo.');
      return;
    }
    setError(null);
    setSearchParams(next);
  };

  const submitOnChange = (event: { currentTarget: HTMLSelectElement }) =>
    event.currentTarget.form?.requestSubmit();

  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));
  // Remonta al cambiar la URL o al llegar las categorías (defaultValue).
  const formKey = `${searchParams.toString()}|${categories.isSuccess}`;

  return (
    <Card>
      <form key={formKey} onSubmit={apply} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="md:col-span-2 xl:col-span-4">
            <label htmlFor="filter-q" className={LABEL}>
              Buscar
            </label>
            <div className="relative">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-500"
              />
              <Input
                id="filter-q"
                name="q"
                type="search"
                maxLength={100}
                placeholder="Nombre o descripción"
                defaultValue={searchParams.get('q') ?? ''}
                className="pl-11"
              />
            </div>
          </div>
          <div className="xl:col-span-3">
            <label htmlFor="filter-category" className={LABEL}>
              Categoría
            </label>
            <Select
              id="filter-category"
              name="categoryId"
              defaultValue={searchParams.get('categoryId') ?? ''}
              onChange={submitOnChange}
            >
              <option value="">Todas las categorías</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:col-span-3">
            <div>
              <label htmlFor="filter-min" className={LABEL}>
                Precio mínimo
              </label>
              <Input
                id="filter-min"
                name="minPrice"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Q 0.00"
                defaultValue={searchParams.get('minPrice') ?? ''}
                invalid={!!error}
              />
            </div>
            <div>
              <label htmlFor="filter-max" className={LABEL}>
                Precio máximo
              </label>
              <Input
                id="filter-max"
                name="maxPrice"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Sin límite"
                defaultValue={searchParams.get('maxPrice') ?? ''}
                invalid={!!error}
              />
            </div>
          </div>
          {showSort && (
            <div className="xl:col-span-2">
              <label htmlFor="filter-sort" className={LABEL}>
                Ordenar por
              </label>
              <Select
                id="filter-sort"
                name="sort"
                defaultValue={searchParams.get('sort') ?? 'newest'}
                onChange={submitOnChange}
              >
                <option value="newest">Más recientes</option>
                <option value="popularity">Más vendidos</option>
              </Select>
            </div>
          )}
        </div>
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          {hasFilters && (
            <Button
              color="gray"
              variant="soft"
              icon={faXmark}
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Limpiar filtros
            </Button>
          )}
          <Button type="submit" icon={faMagnifyingGlass}>
            Buscar
          </Button>
        </div>
      </form>
    </Card>
  );
}
