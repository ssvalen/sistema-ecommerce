import { faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Order } from '@sistema-e/contracts';
import { useState } from 'react';
import { Link } from 'react-router';
import { hasCode, notifyError } from '@/shared/http/errors';
import { cx } from '@/shared/lib/cx';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/feedback';
import { toast } from '@/shared/ui/toast';
import { usePayOrder } from '../hooks';
import { StockIssues } from './StockIssues';

const STOCK_CODES = ['INSUFFICIENT_STOCK', 'PRODUCT_UNAVAILABLE'];

// Paso 2 del checkout (TX2).
export function PaymentPanel({ order, className }: { order: Order; className?: string }) {
  const pay = usePayOrder(order.id);
  const [simulateDecline, setSimulateDecline] = useState(false);

  const onPay = () =>
    pay.mutate(
      { simulatedResult: simulateDecline ? 'DECLINED' : 'APPROVED' },
      {
        onSuccess: () => toast.success('Pago aprobado. Tu pedido está confirmado.'),
        onError: (error) => {
          if (hasCode(error, 'PAYMENT_DECLINED')) setSimulateDecline(false);
          else if (hasCode(error, 'ORDER_NOT_PENDING')) toast.info(error.message);
          else if (!hasCode(error, ...STOCK_CODES)) notifyError(error);
        },
      },
    );

  return (
    <aside className={cx('panel divide-y divide-slate-100 lg:sticky lg:top-40', className)}>
      <div className="space-y-4 p-6">
        <h2 className="text-lg font-bold text-slate-900">Pago</h2>
        <div className="flex items-start gap-3">
          <FontAwesomeIcon icon={faCreditCard} className="mt-1 text-blue-700" />
          <div>
            <p className="font-semibold text-slate-900">Pago simulado</p>
            <p className="text-sm text-muted">
              Se aprueba al instante y descuenta el stock al confirmar tu pedido.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={simulateDecline}
            onChange={(event) => setSimulateDecline(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-blue-600 pointer-coarse:h-5 pointer-coarse:w-5"
          />
          <span>
            <span className="block font-medium text-slate-900">Simular pago rechazado</span>
            <span className="text-muted">
              Modo de prueba: el pedido queda pendiente y puedes reintentar.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex justify-between text-lg font-bold text-slate-900">
          <span>Total a pagar</span>
          <span className="tabular-nums">{formatMoney(order.total)}</span>
        </div>

        {hasCode(pay.error, 'PAYMENT_DECLINED') && (
          <Alert tone="red">
            <p className="font-semibold">{pay.error.message}</p>
            <p>Tu pedido sigue pendiente; puedes intentarlo de nuevo.</p>
          </Alert>
        )}
        {hasCode(pay.error, ...STOCK_CODES) && (
          <div className="space-y-2">
            <StockIssues error={pay.error} />
            <p className="text-sm text-slate-700">
              Este pedido no se puede pagar mientras falte stock. Puedes esperar a que se reponga o{' '}
              <Link to="/" className="font-semibold text-blue-700 underline underline-offset-4">
                volver a la tienda
              </Link>{' '}
              y armar un pedido nuevo.
            </p>
          </div>
        )}

        <Button
          fullWidth
          variant="gradient"
          icon={faCreditCard}
          loading={pay.isPending}
          onClick={onPay}
        >
          {pay.isPending ? 'Procesando pago...' : `Pagar ${formatMoney(order.total)}`}
        </Button>
      </div>
    </aside>
  );
}
