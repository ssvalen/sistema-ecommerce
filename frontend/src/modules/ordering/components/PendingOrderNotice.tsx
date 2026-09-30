import { faClock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { formatMoney } from '@/shared/lib/format';
import { ButtonLink } from '@/shared/ui/Button';
import { useOrders } from '../hooks';

export function PendingOrderNotice() {
  const orders = useOrders(1);
  const pending = orders.data?.items.find((order) => order.status === 'PENDING_PAYMENT');
  if (!pending) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center">
      <FontAwesomeIcon icon={faClock} className="text-xl text-amber-800" />
      <div className="flex-1">
        <p className="font-semibold text-slate-900">Tienes un pedido pendiente de pago</p>
        <p className="text-sm text-slate-700">
          Pedido #{pending.id} · <span className="tabular-nums">{formatMoney(pending.total)}</span>.
          Tus productos están ahí, con los precios que tenían al crearlo.
        </p>
      </div>
      <ButtonLink to={`/orders/${pending.id}`}>Completar el pago</ButtonLink>
    </div>
  );
}
