import { hasCode } from '@/shared/http/errors';
import { formatNumber } from '@/shared/lib/format';
import { Alert } from '@/shared/ui/feedback';

export function StockIssues({ error }: { error: unknown }) {
  if (!hasCode(error, 'INSUFFICIENT_STOCK', 'PRODUCT_UNAVAILABLE')) return null;

  return (
    <Alert tone="red">
      <p className="font-semibold">{error.message}</p>
      <ul className="list-disc space-y-1 pl-5">
        {error.details.map((detail) => {
          const name = typeof detail.name === 'string' ? detail.name : 'Producto';
          const { requested, available } = detail;
          return (
            <li key={String(detail.productId)}>
              {typeof requested === 'number' && typeof available === 'number'
                ? `${name}: pediste ${formatNumber(requested)}, hay ${formatNumber(available)} disponibles.`
                : `${name}: ya no está disponible.`}
            </li>
          );
        })}
      </ul>
    </Alert>
  );
}
