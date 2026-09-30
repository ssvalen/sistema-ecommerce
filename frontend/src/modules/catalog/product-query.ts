import { IdSchema, ProductListQuerySchema } from '@sistema-e/contracts';
import { useSearchParams } from 'react-router';

export const FILTER_KEYS = ['q', 'categoryId', 'minPrice', 'maxPrice', 'sort'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export function parseProductQuery(params: URLSearchParams, pageSize: number) {
  const raw: Record<string, string | number> = { pageSize };
  for (const key of [...FILTER_KEYS, 'page']) {
    const value = params.get(key);
    if (value) raw[key] = value;
  }
  return ProductListQuerySchema.safeParse(raw);
}

export const hasFilters = (params: URLSearchParams) => FILTER_KEYS.some((key) => params.has(key));

/** Cambiar un filtro vuelve a la página 1. */
export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const setFilters = (changes: Partial<Record<FilterKey, string | null>>) =>
    setSearchParams((params) => {
      for (const [key, value] of Object.entries(changes)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete('page');
      return params;
    });

  const setPage = (page: number) =>
    setSearchParams((params) => {
      if (page > 1) params.set('page', String(page));
      else params.delete('page');
      return params;
    });

  const clearFilters = () => setSearchParams(new URLSearchParams());

  return { searchParams, setFilters, setPage, clearFilters };
}

export function parseId(value: string | undefined): number | null {
  const result = IdSchema.safeParse(value);
  return result.success ? result.data : null;
}
