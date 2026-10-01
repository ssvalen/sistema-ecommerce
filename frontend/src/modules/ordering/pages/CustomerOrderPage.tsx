import { faReceipt } from '@fortawesome/free-solid-svg-icons';
import { IdSchema } from '@sistema-e/contracts';
import { useParams } from 'react-router';
import { hasCode } from '@/shared/http/errors';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { BackLink, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/shared/ui/feedback';
import { OrderItemsPanel } from '../components/OrderItemsPanel';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { useCustomerOrder } from '../hooks';

// Admin: pedido de un cliente, solo lectura.
export function CustomerOrderPage() {
  const params = useParams();
  const userId = IdSchema.safeParse(params.id);
  const orderId = IdSchema.safeParse(params.orderId);
  const order = useCustomerOrder(
    userId.success ? userId.data : null,
    orderId.success ? orderId.data : null,
  );

  const back = (
    <BackLink to={userId.success ? `/admin/users/${userId.data}` : '/admin/users'}>
      Volver al usuario
    </BackLink>
  );

  if (!userId.success || !orderId.success || hasCode(order.error, 'NOT_FOUND')) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={faReceipt}
          title="Pedido no encontrado"
          message="El pedido no existe o no pertenece a este usuario."
        />
      </div>
    );
  }
  if (order.isPending) return <Spinner label="Cargando pedido..." />;
  if (order.isError) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;

  const { data } = order;
  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={`Pedido #${data.id}`}
        subtitle={`Creado el ${formatDateTime(data.createdAt)}`}
        actions={<OrderStatusBadge status={data.status} />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <OrderItemsPanel order={data} className="lg:col-span-2" />
        <Card className="space-y-4">
          <h2 className="font-bold text-slate-900">Pago</h2>
          {data.payment ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Monto</dt>
                <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                  {formatMoney(data.payment.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Fecha</dt>
                <dd className="mt-0.5 text-slate-700">{formatDateTime(data.payment.paidAt)}</dd>
              </div>
              <div>
                <dt className="text-muted">Referencia</dt>
                <dd className="mt-0.5 font-mono text-xs break-all text-slate-700">
                  {data.payment.reference}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted">El cliente todavía no paga este pedido.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
