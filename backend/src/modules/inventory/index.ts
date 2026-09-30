import type { Db } from '../../db/transaction.js';
import { inventoryRepository } from './inventory.repository.js';

// Stock de un producto activo, o null si no existe o está eliminado.
export async function findAvailableStock(db: Db, productId: number): Promise<number | null> {
  const row = await inventoryRepository.findActive(db, productId);
  return row ? row.stock : null;
}
