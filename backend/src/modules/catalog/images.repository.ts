import type { Db } from '../../db/transaction.js';

export const imagesRepository = {
  findById(db: Db, id: number) {
    return db.productImage.findUnique({ where: { id }, select: { contentType: true, data: true } });
  },

  deleteByProduct(db: Db, productId: number) {
    return db.productImage.deleteMany({ where: { productId } });
  },

  create(db: Db, data: { productId: number; contentType: string; data: Uint8Array<ArrayBuffer> }) {
    return db.productImage.create({
      data: { ...data, byteSize: data.data.byteLength },
      select: { id: true },
    });
  },
};
