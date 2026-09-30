import { readLoginState } from '@/shared/lib/login-state';

export function loginReason(state: unknown, mode: 'login' | 'register'): string | null {
  const { from, addToCart } = readLoginState(state);
  const verb = mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta';
  if (addToCart) return `${verb} para agregar ${addToCart.productName} a tu carrito.`;
  if (from?.pathname.startsWith('/cart')) return `${verb} para ver tu carrito.`;
  if (from?.pathname.startsWith('/orders')) return `${verb} para ver tus pedidos.`;
  return null;
}
