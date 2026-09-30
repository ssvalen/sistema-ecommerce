import type { Db } from '../../db/transaction.js';

export const cartRepository = {
  deleteByProduct(db: Db, productId: number) {
    return db.cartItem.deleteMany({ where: { productId } });
  },
};
