import type { OrderSummary } from '@sistema-e/contracts';
import { Link } from 'react-router';
import { formatDateTime, formatMoney, formatNumber } from '@/shared/lib/format';
import { usePageParam } from '@/shared/lib/pagination';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ErrorState } from '@/shared/ui/feedback';
import { useCustomerOrders } from '../hooks';
import { OrderStatusBadge } from './OrderStatusBadge';

export function CustomerOrders({ userId }: { userId: number }) {
  const [page, setPage] = usePageParam();
  const orders = useCustomerOrders(userId, page);

  const columns: Column<OrderSummary>[] = [
    {
      header: 'Pedido',
      cell: (order) => (
        <Link
          to={`/admin/users/${userId}/orders/${order.id}`}
          className="font-medium text-slate-800 hover:text-blue-700"
        >
          #{order.id}
        </Link>
      ),
    },
    {
      header: 'Fecha',
      cell: (order) => formatDateTime(order.createdAt),
      className: 'whitespace-nowrap',
    },
    { header: 'Artículos', cell: (order) => formatNumber(order.itemCount) },
    {
      header: 'Total',
      cell: (order) => formatMoney(order.total),
      className: 'whitespace-nowrap',
    },
    { header: 'Estado', cell: (order) => <OrderStatusBadge status={order.status} /> },
  ];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900">Pedidos</h2>
      {orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={orders.data?.items}
          rowKey={(order) => order.id}
          loading={orders.isFetching}
          emptyMessage="Este cliente todavía no tiene pedidos."
          pagination={
            orders.data && {
              page,
              totalPages: orders.data.meta.totalPages,
              total: orders.data.meta.total,
              onPageChange: setPage,
            }
          }
        />
      )}
    </section>
  );
}
