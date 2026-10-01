import { faCircleCheck, faReceipt, faStore } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IdSchema } from '@sistema-e/contracts';
import { useParams } from 'react-router';
import { hasCode } from '@/shared/http/errors';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { ButtonLink } from '@/shared/ui/Button';
import { BackLink, EmptyState, ErrorState, Spinner } from '@/shared/ui/feedback';
import { CheckoutSteps } from '../components/CheckoutSteps';
import { OrderItemsPanel } from '../components/OrderItemsPanel';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { PaymentPanel } from '../components/PaymentPanel';
import { useOrder } from '../hooks';

function NotFound() {
  return (
    <EmptyState
      icon={faReceipt}
      title="Pedido no encontrado"
      message="El pedido no existe o no pertenece a tu cuenta."
      action={<ButtonLink to="/orders">Ver mis pedidos</ButtonLink>}
    />
  );
}

export function OrderDetailPage() {
  const params = useParams();
  const parsed = IdSchema.safeParse(params.id);
  const order = useOrder(parsed.success ? parsed.data : null);

  if (!parsed.success) return <NotFound />;
  if (order.isPending) return <Spinner label="Cargando pedido..." />;
  if (order.isError) {
    return hasCode(order.error, 'NOT_FOUND') ? (
      <NotFound />
    ) : (
      <ErrorState error={order.error} onRetry={() => void order.refetch()} />
    );
  }

  const { data } = order;
  const pending = data.status === 'PENDING_PAYMENT';

  return (
    <div className="space-y-8">
      <BackLink to="/orders">Mis pedidos</BackLink>
      <div className="max-w-md">
        <CheckoutSteps current={pending ? 2 : 3} />
      </div>

      {pending ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-balance text-slate-900">Completa tu pago</h1>
              <p className="mt-1 text-sm text-muted">
                Pedido #{data.id} · creado el {formatDateTime(data.createdAt)}
              </p>
            </div>
            <OrderStatusBadge status={data.status} />
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <PaymentPanel order={data} className="order-first lg:order-last" />
            <OrderItemsPanel order={data} className="lg:col-span-2" />
          </div>
        </>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 md:flex-row md:items-center">
            <FontAwesomeIcon icon={faCircleCheck} className="text-4xl text-emerald-700" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-balance text-slate-900">
                Pedido #{data.id} confirmado
              </h1>
              {data.payment && (
                <>
                  <p className="mt-1 text-sm text-slate-700">
                    Pagaste <span className="tabular-nums">{formatMoney(data.payment.amount)}</span>{' '}
                    el {formatDateTime(data.payment.paidAt)}.
                  </p>
                  <p className="mt-1 font-mono text-xs break-all text-slate-600">
                    Referencia: {data.payment.reference}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/" icon={faStore}>
                Seguir comprando
              </ButtonLink>
              <ButtonLink to="/orders" color="gray" variant="outline">
                Ver mis pedidos
              </ButtonLink>
            </div>
          </section>
          <OrderItemsPanel order={data} />
        </>
      )}
    </div>
  );
}
