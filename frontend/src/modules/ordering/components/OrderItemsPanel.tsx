import type { Order } from '@sistema-e/contracts';
import { Link } from 'react-router';
import { cx } from '@/shared/lib/cx';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { ProductImage } from '@/shared/ui/ProductImage';

export function OrderItemsPanel({ order, className }: { order: Order; className?: string }) {
  return (
    <section className={cx('panel', className)}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="font-bold text-slate-900">Productos del pedido</h2>
        <span className="text-sm text-muted tabular-nums">
          {formatNumber(order.itemCount)} {order.itemCount === 1 ? 'artículo' : 'artículos'}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 px-6 py-4">
            <ProductImage
              src={item.imageUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl border border-slate-100"
            />
            <div className="min-w-0 flex-1">
              <Link
                to={`/products/${item.productId}`}
                className="line-clamp-2 font-medium wrap-break-word text-slate-900 hover:text-blue-700"
              >
                {item.name}
              </Link>
              <p className="text-sm text-muted tabular-nums">
                {formatNumber(item.quantity)} × {formatMoney(item.unitPrice)}
              </p>
            </div>
            <p className="font-semibold text-slate-900 tabular-nums">
              {formatMoney(item.subtotal)}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-slate-200 px-6 py-4 text-lg font-bold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(order.total)}</span>
      </div>
    </section>
  );
}
