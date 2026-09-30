import { hasCode, notifyError } from '@/shared/http/errors';
import { toast } from '@/shared/ui/toast';

export function notifyCartError(error: unknown): void {
  if (hasCode(error, 'INSUFFICIENT_STOCK')) {
    const available = error.details[0]?.available;
    if (typeof available === 'number') {
      toast.error(`${error.message} Disponibles: ${available}.`);
      return;
    }
  }
  notifyError(error);
}
