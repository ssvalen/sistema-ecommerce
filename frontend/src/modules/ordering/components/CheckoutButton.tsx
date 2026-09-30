import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router';
import { errorMessage, hasCode, notifyError } from '@/shared/http/errors';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/toast';
import { useCreateOrder } from '../hooks';
import { StockIssues } from './StockIssues';

interface CheckoutButtonProps {
  disabled?: boolean;
  /** Sin detalle de stock (barra móvil). */
  compact?: boolean;
}

const STOCK_CODES = ['INSUFFICIENT_STOCK', 'PRODUCT_UNAVAILABLE'];

// Paso 1 del checkout (TX1).
export function CheckoutButton({ disabled = false, compact = false }: CheckoutButtonProps) {
  const createOrder = useCreateOrder();
  const navigate = useNavigate();

  const onClick = () =>
    createOrder.mutate(undefined, {
      onSuccess: (order) => {
        toast.success(`Pedido #${order.id} creado. Falta confirmar el pago.`);
        void navigate(`/orders/${order.id}`);
      },
      onError: (error) => {
        if (!hasCode(error, ...STOCK_CODES)) notifyError(error);
        else if (compact) toast.error(errorMessage(error));
      },
    });

  return (
    <div className="space-y-3">
      {!compact && <StockIssues error={createOrder.error} />}
      <Button
        fullWidth
        variant="gradient"
        icon={faArrowRight}
        loading={createOrder.isPending}
        disabled={disabled}
        onClick={onClick}
      >
        {createOrder.isPending ? 'Creando pedido...' : 'Continuar al pago'}
      </Button>
    </div>
  );
}
