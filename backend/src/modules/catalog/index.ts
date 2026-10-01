import type { Db } from '../../db/transaction.js';
import { productsRepository } from './products.repository.js';

export { productImageUrl } from './product.mapper.js';

export function isActiveProduct(db: Db, id: number): Promise<boolean> {
  return productsRepository.isActive(db, id);
}
