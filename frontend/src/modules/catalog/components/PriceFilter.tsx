import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/form';
import { useCatalogParams } from '../product-query';

export function PriceFilter({ id }: { id: string }) {
  const { searchParams, setFilters } = useCatalogParams();
  const [error, setError] = useState<string | null>(null);
  const min = searchParams.get('minPrice') ?? '';
  const max = searchParams.get('maxPrice') ?? '';

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => {
      const value = data.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const nextMin = read('minPrice');
    const nextMax = read('maxPrice');
    if (nextMin && nextMax && Number(nextMin) > Number(nextMax)) {
      setError('El precio mínimo no puede ser mayor que el máximo.');
      return;
    }
    setError(null);
    setFilters({ minPrice: nextMin || null, maxPrice: nextMax || null });
  };

  return (
    <form
      id={id}
      key={`${min}|${max}`}
      onSubmit={onSubmit}
      aria-label="Filtrar por precio"
      className="w-full md:w-auto"
    >
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-min`} className="sr-only">
          Precio mínimo en quetzales
        </label>
        <Input
          id={`${id}-min`}
          name="minPrice"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder="Q mín."
          defaultValue={min}
          invalid={!!error}
          className="h-10 min-w-0 flex-1 md:w-28 md:flex-none"
        />
        <span aria-hidden="true" className="text-muted">
          –
        </span>
        <label htmlFor={`${id}-max`} className="sr-only">
          Precio máximo en quetzales
        </label>
        <Input
          id={`${id}-max`}
          name="maxPrice"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder="Q máx."
          defaultValue={max}
          invalid={!!error}
          className="h-10 min-w-0 flex-1 md:w-28 md:flex-none"
        />
        <Button type="submit" size="sm" color="gray" variant="soft">
          Aplicar
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
