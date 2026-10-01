import type { Db } from '../../db/transaction.js';
import { ordersRepository } from './orders.repository.js';

// Habilita la reseña: el cliente tiene un pedido completado que incluye el producto.
export function hasCompletedPurchase(db: Db, userId: number, productId: number): Promise<boolean> {
  return ordersRepository.hasCompletedPurchase(db, userId, productId);
}
