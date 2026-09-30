import type { OrderStatus } from '@sistema-e/contracts';
import { Badge } from '@/shared/ui/feedback';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return status === 'COMPLETED' ? (
    <Badge tone="green">Completado</Badge>
  ) : (
    <Badge tone="amber">Pendiente de pago</Badge>
  );
}
