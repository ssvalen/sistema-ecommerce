import {
  faChevronRight,
  faCreditCard,
  faReceipt,
  faStore,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { OrderSummary } from '@sistema-e/contracts';
import { Link } from 'react-router';
import { cx } from '@/shared/lib/cx';
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format';
import { usePageParam } from '@/shared/lib/pagination';
import { ButtonLink } from '@/shared/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/feedback';
import { PageNav } from '@/shared/ui/PageNav';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { useOrders } from '../hooks';

function OrderCard({ order }: { order: OrderSummary }) {
  const pending = order.status === 'PENDING_PAYMENT';
  return (
    <li className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold text-slate-900">Pedido #{order.id}</p>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {formatDateTime(order.createdAt)} · {formatNumber(order.itemCount)}{' '}
          {order.itemCount === 1 ? 'artículo' : 'artículos'}
        </p>
      </div>
      <p className="text-lg font-bold text-slate-900 tabular-nums">{formatMoney(order.total)}</p>
      {pending ? (
        <ButtonLink to={`/orders/${order.id}`} size="sm" icon={faCreditCard}>
          Pagar
        </ButtonLink>
      ) : (
        <Link
          to={`/orders/${order.id}`}
          className="flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
        >
          Ver detalle
          <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
        </Link>
      )}
    </li>
  );
}

export function OrdersPage() {
  const [page, setPage] = usePageParam();
  const orders = useOrders(page);

  let content;
  if (orders.isError) {
    content = <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />;
  } else if (!orders.data) {
    content = (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  } else if (orders.data.items.length === 0) {
    content = (
      <EmptyState
        icon={faReceipt}
        title={
          orders.data.meta.total === 0
            ? 'Todavía no tienes pedidos'
            : 'No hay pedidos en esta página'
        }
        message="Cuando completes una compra desde el carrito, aparecerá aquí."
        action={
          <ButtonLink to="/" icon={faStore}>
            Ir a la tienda
          </ButtonLink>
        }
      />
    );
  } else {
    content = (
      <>
        <ul className={cx('space-y-3', orders.isPlaceholderData && 'opacity-60')}>
          {orders.data.items.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
        <PageNav page={page} totalPages={orders.data.meta.totalPages} onPageChange={setPage} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mis pedidos</h1>
        <p className="mt-1 text-sm text-muted">Historial de tus compras y su estado.</p>
      </div>
      {content}
    </div>
  );
}
