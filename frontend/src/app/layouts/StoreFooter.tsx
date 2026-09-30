import { Link } from 'react-router';
import { useSession } from '@/modules/identity';
import { Logo } from './Logo';

const LINK =
  'text-sm text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline';

export function StoreFooter() {
  const { user } = useSession();

  const account =
    user?.role === 'ADMIN'
      ? [{ to: '/admin/products', label: 'Panel de administración' }]
      : user
        ? [
            { to: '/cart', label: 'Carrito' },
            { to: '/orders', label: 'Mis pedidos' },
          ]
        : [
            { to: '/login', label: 'Iniciar sesión' },
            { to: '/register', label: 'Crear cuenta' },
          ];

  return (
    <footer data-surface="dark" className="mt-16 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3 md:px-6">
        <div className="space-y-4">
          <Logo subtitle="Tienda en línea" dark />
          <p className="max-w-xs text-sm text-slate-400">
            Los más vendidos de la tienda, con catálogo, carrito y pedidos en un solo lugar.
          </p>
        </div>
        <nav aria-label="Tienda">
          <h2 className="mb-4 text-sm font-semibold text-white">Tienda</h2>
          <ul className="space-y-2">
            <li>
              <Link to="/" className={LINK}>
                Catálogo
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Mi cuenta">
          <h2 className="mb-4 text-sm font-semibold text-white">Mi cuenta</h2>
          <ul className="space-y-2">
            {account.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={LINK}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-slate-800 py-5 text-center text-sm text-slate-400">
        © 2026 Sistema E
      </div>
    </footer>
  );
}
