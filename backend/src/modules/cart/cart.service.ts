import type { Cart, CartItemAddBody } from '@sistema-e/contracts';
import { prisma } from '../../db/prisma.js';
import { withTransaction } from '../../db/transaction.js';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';
import { rethrowDbError } from '../../errors/db-errors.js';
import { Prisma } from '../../generated/prisma/client.js';
import { productImageUrl } from '../catalog/index.js';
import { findAvailableStock } from '../inventory/index.js';
import { cartRepository, type CartItemRow } from './cart.repository.js';

const productNotFound = () => new NotFoundError('El producto no existe.');
const itemNotFound = () => new NotFoundError('El producto no está en el carrito.');
const insufficientStock = (productId: number, requested: number, available: number) =>
  new ConflictError('INSUFFICIENT_STOCK', 'No hay stock suficiente para esa cantidad.', [
    { productId, requested, available },
  ]);

function toCart(rows: CartItemRow[]): Cart {
  let total = new Prisma.Decimal(0);
  let itemCount = 0;
  const items = rows.map(({ quantity, product }) => {
    const subtotal = product.price.mul(quantity);
    total = total.add(subtotal);
    itemCount += quantity;
    return {
      productId: product.id,
      name: product.name,
      imageUrl: productImageUrl(product),
      unitPrice: product.price.toFixed(2),
      quantity,
      subtotal: subtotal.toFixed(2),
      stock: product.stock,
      available: quantity <= product.stock,
    };
  });
  return { items, itemCount, total: total.toFixed(2) };
}

export async function getCart(userId: number): Promise<Cart> {
  return toCart(await cartRepository.listByUser(prisma, userId));
}

export async function addItem(
  userId: number,
  { productId, quantity }: CartItemAddBody,
): Promise<Cart> {
  await withTransaction(async (tx) => {
    const stock = await findAvailableStock(tx, productId);
    if (stock === null) throw productNotFound();
    const item = await cartRepository.upsertIncrement(tx, userId, productId, quantity);
    if (item.quantity > stock) throw insufficientStock(productId, item.quantity, stock);
  });
  return getCart(userId);
}

export async function updateItem(
  userId: number,
  productId: number,
  quantity: number,
): Promise<Cart> {
  const stock = await findAvailableStock(prisma, productId);
  if (stock === null) throw itemNotFound();
  if (quantity > stock) throw insufficientStock(productId, quantity, stock);
  await cartRepository
    .setQuantity(prisma, userId, productId, quantity)
    .catch((error: unknown) => rethrowDbError(error, { notFound: itemNotFound() }));
  return getCart(userId);
}

export async function removeItem(userId: number, productId: number): Promise<void> {
  await cartRepository
    .delete(prisma, userId, productId)
    .catch((error: unknown) => rethrowDbError(error, { notFound: itemNotFound() }));
}
