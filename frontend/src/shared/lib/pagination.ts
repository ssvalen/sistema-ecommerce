import { useSearchParams } from 'react-router';

export function usePageParam(): [number, (page: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = Number(searchParams.get('page'));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;

  const setPage = (next: number) => {
    setSearchParams((params) => {
      if (next > 1) params.set('page', String(next));
      else params.delete('page');
      return params;
    });
  };

  return [page, setPage];
}
