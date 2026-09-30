import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

// En el catálogo conserva los demás filtros.
export function SearchBar() {
  const id = useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const onCatalog = pathname === '/';
  const current = onCatalog ? (searchParams.get('q') ?? '') : '';

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const entry = new FormData(event.currentTarget).get('q');
    const q = typeof entry === 'string' ? entry.trim() : '';
    const params = new URLSearchParams(onCatalog ? searchParams : undefined);
    params.delete('page');
    if (q) params.set('q', q);
    else params.delete('q');
    void navigate({ pathname: '/', search: params.toString() });
  };

  return (
    <form key={current} role="search" onSubmit={onSubmit} className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <input
        id={id}
        name="q"
        type="search"
        maxLength={100}
        defaultValue={current}
        placeholder="Buscar productos..."
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-14 pl-4 text-sm text-slate-800 transition-colors placeholder:text-muted focus:border-blue-600 focus:bg-white"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute top-1 right-1 flex h-9 w-11 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700"
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} />
      </button>
    </form>
  );
}
