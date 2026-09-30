import { zodResolver } from '@hookform/resolvers/zod';
import {
  InventoryAdjustmentBodySchema,
  type InventoryAdjustmentBody,
  type InventoryItem,
} from '@sistema-e/contracts';
import { useForm, useWatch } from 'react-hook-form';
import { applyFieldErrors, hasCode, notifyError } from '@/shared/http/errors';
import { formatNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { FormField, Input } from '@/shared/ui/form';
import { Modal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast';
import { useAdjustStock } from '../hooks';

interface AdjustStockModalProps {
  item: InventoryItem | null;
  onClose: () => void;
}

function AdjustStockForm({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const adjust = useAdjustStock();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<InventoryAdjustmentBody>({
    resolver: zodResolver(InventoryAdjustmentBodySchema),
  });
  const adjustment = useWatch({ control, name: 'adjustment' });
  const result = Number.isInteger(adjustment) ? item.stock + adjustment : null;

  const onSubmit = handleSubmit(({ adjustment }) =>
    adjust.mutate(
      { productId: item.productId, adjustment },
      {
        onSuccess: (updated) => {
          toast.success(`Stock de ${updated.name}: ${formatNumber(updated.stock)} unidades.`);
          onClose();
        },
        onError: (error) => {
          if (hasCode(error, 'INSUFFICIENT_STOCK')) {
            setError('adjustment', { type: 'server', message: error.message });
          } else if (!applyFieldErrors(error, setError, ['adjustment'])) {
            notifyError(error);
          }
        },
      },
    ),
  );

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-5">
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="font-medium text-slate-800">{item.name}</p>
        <p className="text-sm text-slate-500">
          {item.categoryName} · Stock actual: {formatNumber(item.stock)}
        </p>
      </div>
      <FormField
        label="Ajuste"
        htmlFor="adjustment"
        error={errors.adjustment?.message}
        hint="Positivo para sumar unidades, negativo para restarlas."
      >
        <Input
          id="adjustment"
          type="number"
          step={1}
          placeholder="Ej.: 10 o -3"
          autoFocus
          invalid={!!errors.adjustment}
          {...register('adjustment', { valueAsNumber: true })}
        />
      </FormField>
      {result !== null && (
        <p className="text-sm text-slate-600">
          Stock resultante:{' '}
          <span
            className={result < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-slate-800'}
          >
            {formatNumber(result)}
          </span>
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button color="gray" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={adjust.isPending}>
          Aplicar ajuste
        </Button>
      </div>
    </form>
  );
}

export function AdjustStockModal({ item, onClose }: AdjustStockModalProps) {
  return (
    <Modal open={item !== null} title="Ajustar stock" onClose={onClose} size="sm">
      {item && <AdjustStockForm key={item.productId} item={item} onClose={onClose} />}
    </Modal>
  );
}
