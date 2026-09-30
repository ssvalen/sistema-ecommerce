import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCartShopping,
  faGauge,
  faReceipt,
  faRightFromBracket,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, NavLink, useLocation } from 'react-router';
import { useCartCount } from '@/modules/cart';
import { CategoryNav, SearchBar } from '@/modules/catalog';
import { useLogout, useSession } from '@/modules/identity';
import { notifyError } from '@/shared/http/errors';
import { cx } from '@/shared/lib/cx';
import type { LoginState } from '@/shared/lib/login-state';
import { ButtonLink } from '@/shared/ui/Button';
import { Logo } from './Logo';

const ACTION =
  'relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors';

const actionClass = ({ isActive }: { isActive: boolean }) =>
  cx(ACTION, isActive ? 'bg-accent-soft text-cyan-800' : 'text-slate-700 hover:bg-slate-100');

function HeaderAction({ to, icon, label }: { to: string; icon: IconDefinition; label: string }) {
  return (
    <NavLink to={to} className={actionClass} aria-label={label}>
      <FontAwesomeIcon icon={icon} className="text-lg" />
      <span className="hidden lg:inline">{label}</span>
    </NavLink>
  );
}

function CartAction({ count }: { count: number }) {
  return (
    <NavLink to="/cart" className={actionClass} aria-label={`Carrito: ${count} artículos`}>
      <span className="relative">
        <FontAwesomeIcon icon={faCartShopping} className="text-lg" />
        {count > 0 && (
          // La clave reinicia la animación.
          <span
            key={count}
            className="absolute -top-2.5 -right-3 flex h-5 min-w-5 animate-bump items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-white tabular-nums"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="hidden lg:ml-1 lg:inline">Carrito</span>
    </NavLink>
  );
}

function AccountActions() {
  const { user } = useSession();
  const logout = useLogout();
  const location = useLocation();
  const loginState: LoginState = { from: { pathname: location.pathname, search: location.search } };

  if (!user) {
    return (
      <>
        <Link
          to="/login"
          state={loginState}
          className={cx(ACTION, 'text-slate-700 hover:bg-slate-100')}
        >
          <FontAwesomeIcon icon={faUser} className="text-lg" />
          <span className="hidden sm:inline">Iniciar sesión</span>
        </Link>
        <span className="hidden md:block">
          <ButtonLink to="/register" state={loginState} size="sm">
            Crear cuenta
          </ButtonLink>
        </span>
      </>
    );
  }

  return (
    <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white uppercase"
      >
        {user.name.charAt(0)}
      </span>
      <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-900 lg:block">
        {user.name}
      </span>
      <button
        type="button"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onError: notifyError })}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-rose-700 disabled:opacity-50"
      >
        <FontAwesomeIcon icon={faRightFromBracket} />
      </button>
    </div>
  );
}

// En móvil, buscador y categorías quedan fuera del encabezado fijo.
export function StoreHeader() {
  const { user } = useSession();
  const cartCount = useCartCount();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:h-20 md:gap-8 md:px-6">
          <Logo subtitle="Tienda en línea" />
          <div className="hidden flex-1 md:block">
            <SearchBar />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {user?.role === 'ADMIN' && (
              <ButtonLink to="/admin/products" size="sm" variant="soft" icon={faGauge}>
                Panel
              </ButtonLink>
            )}
            {user?.role === 'CUSTOMER' && (
              <HeaderAction to="/orders" icon={faReceipt} label="Mis pedidos" />
            )}
            {user?.role !== 'ADMIN' && <CartAction count={cartCount} />}
            <AccountActions />
          </div>
        </div>
        <CategoryNav className="hidden border-t border-slate-100 md:block" />
      </header>
      <div className="border-b border-slate-200 bg-white md:hidden">
        <div className="px-4 pt-3">
          <SearchBar />
        </div>
        <CategoryNav />
      </div>
    </>
  );
}
