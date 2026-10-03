import type { Db } from '../../db/transaction.js';
import { ordersRepository } from './orders.repository.js';

export function hasCompletedPurchase(db: Db, userId: number, productId: number): Promise<boolean> {
  return ordersRepository.hasCompletedPurchase(db, userId, productId);
}
