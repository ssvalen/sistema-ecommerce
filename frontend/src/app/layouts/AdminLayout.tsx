import { faBars } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useSession } from '@/modules/identity';
import { AdminSidebar } from './AdminSidebar';

function AdminHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useSession();

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 lg:hidden"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <div>
          <p className="text-lg font-bold text-slate-800 md:text-2xl">Panel de administración</p>
          <p className="mt-1 hidden text-sm text-muted md:block">
            Gestiona el catálogo, el inventario y las cuentas.
          </p>
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-100 px-2 py-2 md:px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white uppercase">
            {user.name.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <p className="leading-none font-semibold text-slate-800">{user.name}</p>
            <p className="mt-1 text-sm text-slate-600">Administrador</p>
          </div>
        </div>
      )}
    </header>
  );
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname, search } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname, search]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
