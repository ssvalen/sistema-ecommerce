import { faCartPlus, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useSession } from '@/modules/identity';
import type { LoginState } from '@/shared/lib/login-state';
import { Button, ButtonLink, type ButtonVariant } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/toast';
import { useAddToCart } from '../hooks';
import { notifyCartError } from '../stock-error';

const ADDED_FEEDBACK_MS = 2000;

function Label({ short, long }: { short: string; long: string }) {
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  );
}

interface AddToCartButtonProps {
  productId: number;
  productName: string;
  stock: number;
  quantity?: number;
  size?: 'sm' | 'md';
  variant?: Exclude<ButtonVariant, 'gradient'>;
}

// Visitante: se agrega al volver del login (PendingCartAdd).
export function AddToCartButton({
  productId,
  productName,
  stock,
  quantity = 1,
  size = 'md',
  variant = 'solid',
}: AddToCartButtonProps) {
  const { user } = useSession();
  const location = useLocation();
  const add = useAddToCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (user?.role === 'ADMIN') return null;
  if (stock === 0) {
    return (
      <Button fullWidth size={size} color="gray" variant="soft" disabled>
        Agotado
      </Button>
    );
  }
  if (!user) {
    const state: LoginState = {
      from: { pathname: location.pathname, search: location.search },
      addToCart: { productId, quantity, productName },
    };
    return (
      <ButtonLink
        to="/login"
        state={state}
        fullWidth
        size={size}
        variant={variant}
        icon={faCartPlus}
      >
        <Label short="Agregar" long="Agregar al carrito" />
      </ButtonLink>
    );
  }

  const onClick = () =>
    add.mutate(
      { productId, quantity },
      {
        onSuccess: () => {
          toast.success(
            quantity === 1
              ? `Agregaste ${productName}.`
              : `Agregaste ${quantity} × ${productName}.`,
            { label: 'Ver carrito', to: '/cart' },
          );
          setAdded(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
        },
        onError: notifyCartError,
      },
    );

  return (
    <Button
      fullWidth
      size={size}
      variant={added ? 'soft' : variant}
      color={added ? 'green' : 'blue'}
      icon={added ? faCheck : faCartPlus}
      loading={add.isPending}
      onClick={onClick}
    >
      {added ? (
        <Label short="Agregado" long="En el carrito" />
      ) : (
        <Label short="Agregar" long="Agregar al carrito" />
      )}
    </Button>
  );
}
