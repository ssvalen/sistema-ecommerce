import {
  faArrowLeft,
  faCartShopping,
  faCircleInfo,
  faStore,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { CartItem } from '@sistema-e/contracts';
import { Link } from 'react-router';
import { CheckoutButton, CheckoutSteps, PendingOrderNotice } from '@/modules/ordering';
import { formatMoney, formatNumber } from '@/shared/lib/format';
import { ButtonLink } from '@/shared/ui/Button';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/shared/ui/feedback';
import { ProductImage } from '@/shared/ui/ProductImage';
import { QuantityStepper } from '@/shared/ui/QuantityStepper';
import { toast } from '@/shared/ui/toast';
import { useCart, useRemoveCartItem, useUpdateCartItem } from '../hooks';
import { notifyCartError } from '../stock-error';

const MAX_QUANTITY = 1000;

function CartItemRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const busy = update.isPending || remove.isPending;
  const detail = `/products/${item.productId}`;

  const setQuantity = (quantity: number) =>
    update.mutate({ productId: item.productId, quantity }, { onError: notifyCartError });

  const removeItem = () =>
    remove.mutate(item.productId, {
      onSuccess: () => toast.info(`Quitaste ${item.name} del carrito.`),
      onError: notifyCartError,
    });

  return (
    <li className="flex gap-4 p-4 sm:p-5">
      <Link to={detail} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <ProductImage
          src={item.imageUrl}
          alt=""
          className="h-16 w-16 rounded-xl border border-slate-100 sm:h-24 sm:w-24"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <Link
            to={detail}
            className="line-clamp-2 font-semibold wrap-break-word text-slate-900 hover:text-blue-700"
          >
            {item.name}
          </Link>
          <p className="mt-1 text-sm text-muted tabular-nums">{formatMoney(item.unitPrice)} c/u</p>
        </div>
        {!item.available && (
          <Alert tone="amber">
            {item.stock === 0 ? (
              <p>Este producto se agotó. Quítalo del carrito para continuar.</p>
            ) : (
              <>
                <p>Solo quedan {formatNumber(item.stock)} unidades disponibles.</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setQuantity(item.stock)}
                  className="font-semibold underline underline-offset-4 hover:no-underline"
                >
                  Ajustar a {formatNumber(item.stock)}
                </button>
              </>
            )}
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <QuantityStepper
            value={item.quantity}
            max={Math.min(Math.max(item.stock, 1), MAX_QUANTITY)}
            disabled={busy}
            onChange={setQuantity}
            label={`Cantidad de ${item.name}`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={removeItem}
            className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-rose-700 disabled:opacity-50 pointer-coarse:min-h-11"
          >
            <FontAwesomeIcon icon={faTrash} />
            Quitar
          </button>
          <p className="ml-auto text-lg font-bold text-slate-900 tabular-nums">
            {formatMoney(item.subtotal)}
          </p>
        </div>
      </div>
    </li>
  );
}

function CartSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="panel space-y-4 p-5 lg:col-span-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

function CheckoutNotice() {
  return (
    <p className="flex gap-2 text-sm text-slate-700">
      <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 text-blue-700" />
      <span>
        Al continuar, tus productos pasan a un pedido pendiente de pago con los precios de hoy. El
        stock se descuenta cuando pagas.
      </span>
    </p>
  );
}

export function CartPage() {
  const cart = useCart();
  const itemCount = cart.data?.itemCount ?? 0;

  let content;
  if (cart.isPending) {
    content = <CartSkeleton />;
  } else if (cart.isError) {
    content = <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;
  } else if (cart.data.items.length === 0) {
    content = (
      <div className="space-y-4">
        <PendingOrderNotice />
        <EmptyState
          icon={faCartShopping}
          title="Tu carrito está vacío"
          message="Explora la tienda y agrega los productos que quieras comprar."
          action={
            <ButtonLink to="/" icon={faStore}>
              Ir a la tienda
            </ButtonLink>
          }
        />
      </div>
    );
  } else {
    const { items, total } = cart.data;
    const hasUnavailable = items.some((item) => !item.available);
    // La clave descarta el error del intento anterior.
    const cartVersion = items.map((item) => `${item.productId}:${item.quantity}`).join(',');
    content = (
      <>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <ul className="panel divide-y divide-slate-100 lg:col-span-2">
            {items.map((item) => (
              <CartItemRow key={item.productId} item={item} />
            ))}
          </ul>
          <aside className="panel space-y-5 p-6 lg:sticky lg:top-40">
            <h2 className="text-lg font-bold text-slate-900">Resumen del pedido</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-700">
                <dt>Artículos</dt>
                <dd className="tabular-nums">{formatNumber(itemCount)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(total)}</dd>
              </div>
            </dl>
            {hasUnavailable && (
              <Alert tone="amber">
                <p>Ajusta los productos sin stock suficiente para continuar.</p>
              </Alert>
            )}
            <CheckoutNotice />
            <div className="hidden lg:block">
              <CheckoutButton key={cartVersion} disabled={hasUnavailable} />
            </div>
            <Link
              to="/"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-700 underline-offset-4 hover:underline"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Seguir comprando
            </Link>
          </aside>
        </div>
        <div className="sticky bottom-0 z-30 -mx-4 flex items-center gap-4 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.25)] md:-mx-6 md:px-6 lg:hidden">
          <div className="shrink-0">
            <p className="text-xs text-muted">Total</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{formatMoney(total)}</p>
          </div>
          <div className="flex-1">
            <CheckoutButton key={cartVersion} disabled={hasUnavailable} compact />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-8">
      <div className="max-w-md">
        <CheckoutSteps current={1} />
      </div>
      <h1 className="text-2xl font-bold text-balance text-slate-900">
        Tu carrito
        {itemCount > 0 && (
          <span className="ml-2 text-base font-normal text-muted tabular-nums">
            ({formatNumber(itemCount)} {itemCount === 1 ? 'artículo' : 'artículos'})
          </span>
        )}
      </h1>
      {content}
    </div>
  );
}
