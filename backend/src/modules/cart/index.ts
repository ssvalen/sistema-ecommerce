import type { Tx } from '../../db/transaction.js';
import { cartRepository } from './cart.repository.js';

export async function removeProductFromCarts(tx: Tx, productId: number): Promise<void> {
  await cartRepository.deleteByProduct(tx, productId);
}

// Bloquea el carrito del usuario hasta el fin de la transacción: evita pedidos duplicados.
export async function lockCartForCheckout(tx: Tx, userId: number) {
  await cartRepository.lockByUser(tx, userId);
  return cartRepository.listForCheckout(tx, userId);
}

export async function removeOrderedItems(tx: Tx, userId: number, productIds: number[]) {
  await cartRepository.deleteItems(tx, userId, productIds);
}
