import type { InventoryItem, PaginationQuery } from '@sistema-e/contracts';
import { invalidateCatalog } from '../../cache/catalog-cache.js';
import { prisma } from '../../db/prisma.js';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';
import { inventoryRepository, type InventoryRow } from './inventory.repository.js';

function toInventoryItem(row: InventoryRow): InventoryItem {
  return {
    productId: row.id,
    name: row.name,
    categoryName: row.category.name,
    stock: row.stock,
    unitsSold: row.unitsSold,
  };
}

export async function listInventory({ page, pageSize }: PaginationQuery) {
  const { rows, total } = await inventoryRepository.list(prisma, (page - 1) * pageSize, pageSize);
  return { items: rows.map(toInventoryItem), total };
}

export async function adjustStock(productId: number, adjustment: number): Promise<InventoryItem> {
  const adjusted = await inventoryRepository.adjust(prisma, productId, adjustment);
  const row = await inventoryRepository.findActive(prisma, productId);
  if (!row) throw new NotFoundError('El producto no existe.');
  if (!adjusted) {
    throw new ConflictError('INSUFFICIENT_STOCK', 'El ajuste dejaría el stock en negativo.', [
      { productId, stock: row.stock, adjustment },
    ]);
  }
  await invalidateCatalog();
  return toInventoryItem(row);
}
