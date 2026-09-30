import type { Db, Tx } from '../../db/transaction.js';
import { inventoryRepository } from './inventory.repository.js';

export interface SaleItem {
  productId: number;
  quantity: number;
}

export interface ProductForSale {
  name: string;
  stock: number;
  active: boolean;
}

// Stock de un producto activo, o null si no existe o está eliminado.
export async function findAvailableStock(db: Db, productId: number): Promise<number | null> {
  const row = await inventoryRepository.findActive(db, productId);
  return row ? row.stock : null;
}

// Bloquea los productos hasta el fin de la transacción y devuelve su estado actual.
export async function lockProductsForSale(
  tx: Tx,
  productIds: number[],
): Promise<Map<number, ProductForSale>> {
  await inventoryRepository.lockByIds(tx, productIds);
  const rows = await inventoryRepository.findForSale(tx, productIds);
  return new Map(
    rows.map((row) => [
      row.id,
      { name: row.name, stock: row.stock, active: row.deletedAt === null },
    ]),
  );
}

// Descuenta el stock y suma unidades vendidas. Requiere lockProductsForSale antes.
export async function recordSale(tx: Tx, items: SaleItem[]): Promise<void> {
  for (const item of [...items].sort((a, b) => a.productId - b.productId)) {
    await inventoryRepository.recordSale(tx, item.productId, item.quantity);
  }
}
