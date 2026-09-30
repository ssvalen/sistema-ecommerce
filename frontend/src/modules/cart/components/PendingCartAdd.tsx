import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSession } from '@/modules/identity';
import { readLoginState } from '@/shared/lib/login-state';
import { toast } from '@/shared/ui/toast';
import { useAddToCart } from '../hooks';
import { notifyCartError } from '../stock-error';

export function PendingCartAdd() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useSession();
  const add = useAddToCart();
  const handledKey = useRef<string | null>(null);
  const intent = readLoginState(location.state).addToCart;

  useEffect(() => {
    if (!intent || user?.role !== 'CUSTOMER' || handledKey.current === location.key) return;
    handledKey.current = location.key;
    add.mutate(
      { productId: intent.productId, quantity: intent.quantity },
      {
        onSuccess: () =>
          toast.success(`Agregaste ${intent.productName}.`, { label: 'Ver carrito', to: '/cart' }),
        onError: notifyCartError,
      },
    );
    // Sin estado, Atrás o recargar no lo repiten.
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  }, [intent, user, location, add, navigate]);

  return null;
}
