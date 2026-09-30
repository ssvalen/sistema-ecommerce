import type { Tx } from '../../db/transaction.js';
import { cartRepository } from './cart.repository.js';

export async function removeProductFromCarts(tx: Tx, productId: number): Promise<void> {
  await cartRepository.deleteByProduct(tx, productId);
}
