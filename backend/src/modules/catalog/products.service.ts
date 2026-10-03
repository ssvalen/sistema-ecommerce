import type {
  Product,
  ProductCreateBody,
  ProductListQuery,
  ProductUpdateBody,
} from '@sistema-e/contracts';
import { fileTypeFromBuffer } from 'file-type';
import {
  cacheKey,
  cached,
  invalidateCatalog,
  type CacheStatus,
} from '../../cache/catalog-cache.js';
import { prisma } from '../../db/prisma.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError, NotFoundError } from '../../errors/app-error.js';
import { rethrowDbError } from '../../errors/db-errors.js';
import { removeProductFromCarts } from '../cart/index.js';
import { NO_RATINGS, ratingSummaries } from '../reviews/index.js';
import { imagesRepository } from './images.repository.js';
import { toProductDto } from './product.mapper.js';
import { productsRepository, type ProductRow } from './products.repository.js';

// Compras y reseñas no invalidan: el listado puede mostrar stock y calificación con hasta 60 s de atraso.
const PRODUCT_LIST_TTL_SECONDS = 60;
// Cambiar si cambia la forma de Product.
const PRODUCT_LIST_CACHE = 'products:v2';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const productNotFound = () => new NotFoundError('El producto no existe.');
const categoryNotFound = () =>
  new AppError(400, 'CATEGORY_NOT_FOUND', 'La categoría indicada no existe.');

async function toProducts(rows: ProductRow[]): Promise<Product[]> {
  const ratings = await ratingSummaries(
    prisma,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toProductDto(row, ratings.get(row.id) ?? NO_RATINGS));
}

async function toProduct(row: ProductRow): Promise<Product> {
  const ratings = await ratingSummaries(prisma, [row.id]);
  return toProductDto(row, ratings.get(row.id) ?? NO_RATINGS);
}

export function listProducts(
  query: ProductListQuery,
): Promise<{ value: { items: Product[]; total: number }; cache: CacheStatus }> {
  const { q, categoryId, minPrice, maxPrice, sort, page, pageSize } = query;
  const key = cacheKey(PRODUCT_LIST_CACHE, [
    q,
    categoryId,
    minPrice,
    maxPrice,
    sort,
    page,
    pageSize,
  ]);
  return cached(key, PRODUCT_LIST_TTL_SECONDS, async () => {
    const { rows, total } = await productsRepository.list(prisma, query);
    return { items: await toProducts(rows), total };
  });
}

export async function getProduct(id: number): Promise<Product> {
  const row = await productsRepository.findActiveById(prisma, id);
  if (!row) throw productNotFound();
  return toProduct(row);
}

export async function createProduct(body: ProductCreateBody): Promise<Product> {
  const row = await productsRepository
    .create(prisma, {
      categoryId: body.categoryId,
      name: body.name,
      description: body.description,
      price: body.price,
      stock: body.stock,
      externalImageUrl: body.imageUrl ?? null,
    })
    .catch((error: unknown) => rethrowDbError(error, { foreignKey: categoryNotFound() }));
  await invalidateCatalog();
  return toProductDto(row, NO_RATINGS);
}

export async function updateProduct(id: number, body: ProductUpdateBody): Promise<Product> {
  const row = await withTransaction(async (tx) => {
    // Un producto tiene como máximo una imagen: la externa o la subida.
    if (body.imageUrl !== undefined) await imagesRepository.deleteByProduct(tx, id);
    return productsRepository.update(tx, id, {
      categoryId: body.categoryId,
      name: body.name,
      description: body.description,
      price: body.price,
      externalImageUrl: body.imageUrl,
    });
  }).catch((error: unknown) =>
    rethrowDbError(error, { notFound: productNotFound(), foreignKey: categoryNotFound() }),
  );
  await invalidateCatalog();
  return toProduct(row);
}

export async function deleteProduct(id: number): Promise<void> {
  await withTransaction(async (tx) => {
    await productsRepository.softDelete(tx, id);
    await removeProductFromCarts(tx, id);
  }).catch((error: unknown) => rethrowDbError(error, { notFound: productNotFound() }));
  await invalidateCatalog();
}

export async function setProductImage(id: number, file: Buffer): Promise<Product> {
  const type = await fileTypeFromBuffer(file);
  if (!type || !ALLOWED_IMAGE_TYPES.has(type.mime)) {
    throw new AppError(415, 'UNSUPPORTED_IMAGE', 'Solo se aceptan imágenes JPEG, PNG o WebP.');
  }
  const row = await withTransaction(async (tx) => {
    if (!(await productsRepository.findActiveById(tx, id))) throw productNotFound();
    await imagesRepository.deleteByProduct(tx, id);
    await imagesRepository.create(tx, {
      productId: id,
      contentType: type.mime,
      data: new Uint8Array(file),
    });
    return productsRepository.update(tx, id, { externalImageUrl: null });
  });
  await invalidateCatalog();
  return toProduct(row);
}

export async function getImage(id: number): Promise<{ contentType: string; data: Uint8Array }> {
  const image = await imagesRepository.findById(prisma, id);
  if (!image) throw new NotFoundError('La imagen no existe.');
  return image;
}
