import { faSliders } from '@fortawesome/free-solid-svg-icons';
import type { InventoryItem } from '@sistema-e/contracts';
import { useState } from 'react';
import { formatNumber } from '@/shared/lib/format';
import { LOW_STOCK } from '@/shared/lib/stock';
import { usePageParam } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Badge, ErrorState, PageHeader } from '@/shared/ui/feedback';
import { AdjustStockModal } from '../components/AdjustStockModal';
import { useInventory } from '../hooks';

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <Badge tone="red">Agotado</Badge>;
  if (stock <= LOW_STOCK) return <Badge tone="amber">{formatNumber(stock)} · Bajo</Badge>;
  return <Badge tone="green">{formatNumber(stock)}</Badge>;
}

export function InventoryAdminPage() {
  const [page, setPage] = usePageParam();
  const inventory = useInventory(page);
  const [target, setTarget] = useState<InventoryItem | null>(null);

  const columns: Column<InventoryItem>[] = [
    {
      header: 'Producto',
      cell: (item) => (
        <div>
          <p className="font-medium text-slate-800">{item.name}</p>
          <p className="text-xs text-muted">#{item.productId}</p>
        </div>
      ),
    },
    { header: 'Categoría', cell: (item) => item.categoryName },
    { header: 'Stock', cell: (item) => <StockBadge stock={item.stock} /> },
    { header: 'Vendidos', cell: (item) => formatNumber(item.unitsSold), className: 'text-right' },
    {
      header: 'Acciones',
      cell: (item) => (
        <Button size="sm" variant="soft" icon={faSliders} onClick={() => setTarget(item)}>
          Ajustar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventario" subtitle="Stock disponible por producto y ajustes manuales." />
      {inventory.isError ? (
        <ErrorState error={inventory.error} onRetry={() => void inventory.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={inventory.data?.items}
          rowKey={(item) => item.productId}
          loading={inventory.isFetching}
          emptyMessage="No hay productos en el inventario."
          pagination={
            inventory.data && {
              page,
              totalPages: inventory.data.meta.totalPages,
              total: inventory.data.meta.total,
              onPageChange: setPage,
            }
          }
        />
      )}
      <AdjustStockModal item={target} onClose={() => setTarget(null)} />
    </div>
  );
}
