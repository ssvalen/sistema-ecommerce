import type { UserRole } from '@sistema-e/contracts';
import { Navigate, Outlet, useLocation } from 'react-router';
import { homePath, useSession } from '@/modules/identity';
import { readLoginState, type LoginState } from '@/shared/lib/login-state';
import { Spinner } from '@/shared/ui/feedback';

export function RequireRole({ role }: { role: UserRole }) {
  const { user, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <Spinner label="Verificando sesión..." />;
  if (!user) {
    const state: LoginState = { from: { pathname: location.pathname, search: location.search } };
    return <Navigate to="/login" replace state={state} />;
  }
  if (user.role !== role) return <Navigate to={homePath(user.role)} replace />;
  return <Outlet />;
}

export function RequireGuest() {
  const { user, isPending } = useSession();
  const location = useLocation();

  if (isPending) return <Spinner label="Verificando sesión..." />;
  if (user) {
    const { from, addToCart } = readLoginState(location.state);
    return (
      <Navigate
        to={from ? from.pathname + from.search : homePath(user.role)}
        replace
        state={addToCart ? { addToCart } : undefined}
      />
    );
  }
  return <Outlet />;
}
