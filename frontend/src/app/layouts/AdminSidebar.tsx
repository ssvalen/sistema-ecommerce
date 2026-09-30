import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxOpen,
  faRightFromBracket,
  faStore,
  faTags,
  faUsers,
  faWarehouse,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, NavLink } from 'react-router';
import { useLogout } from '@/modules/identity';
import { notifyError } from '@/shared/http/errors';
import { cx } from '@/shared/lib/cx';
import { Logo } from './Logo';

const NAVIGATION: { to: string; label: string; icon: IconDefinition }[] = [
  { to: '/admin/products', label: 'Productos', icon: faBoxOpen },
  { to: '/admin/categories', label: 'Categorías', icon: faTags },
  { to: '/admin/inventory', label: 'Inventario', icon: faWarehouse },
  { to: '/admin/users', label: 'Usuarios', icon: faUsers },
];

const ITEM = 'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200';

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const logout = useLogout();

  return (
    <>
      <div
        onClick={onClose}
        className={cx(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      />
      <aside
        data-surface="dark"
        className={cx(
          'fixed top-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-900 text-white transition-transform duration-300 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-800 px-6">
          <Logo subtitle="Administración" dark onClick={onClose} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="h-10 w-10 rounded-xl hover:bg-slate-800 lg:hidden"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-auto p-4">
          {NAVIGATION.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cx(
                  ITEM,
                  isActive
                    ? 'bg-accent text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <FontAwesomeIcon icon={item.icon} className="w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-800 p-4">
          <Link to="/" className={cx(ITEM, 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
            <FontAwesomeIcon icon={faStore} className="w-5" />
            <span>Ver tienda</span>
          </Link>
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onError: notifyError })}
            className={cx(ITEM, 'w-full text-rose-300 hover:bg-rose-500/20 disabled:opacity-50')}
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-5" />
            <span>{logout.isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
