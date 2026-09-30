import type { Category, CategoryCreateBody, CategoryUpdateBody } from '@sistema-e/contracts';
import { cached, invalidateCatalog, type CacheStatus } from '../../cache/catalog-cache.js';
import { prisma } from '../../db/prisma.js';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';
import { rethrowDbError } from '../../errors/db-errors.js';
import { categoriesRepository } from './categories.repository.js';

const CATEGORIES_TTL_SECONDS = 600;

const notFound = () => new NotFoundError('La categoría no existe.');
const nameTaken = () =>
  new ConflictError('CATEGORY_NAME_TAKEN', 'Ya existe una categoría con ese nombre.');

export function listCategories(): Promise<{ value: Category[]; cache: CacheStatus }> {
  return cached('categories', CATEGORIES_TTL_SECONDS, () => categoriesRepository.list(prisma));
}

export async function getCategory(id: number): Promise<Category> {
  const category = await categoriesRepository.findById(prisma, id);
  if (!category) throw notFound();
  return category;
}

export async function createCategory(body: CategoryCreateBody): Promise<Category> {
  const category = await categoriesRepository
    .create(prisma, { name: body.name, description: body.description ?? null })
    .catch((error: unknown) => rethrowDbError(error, { unique: nameTaken() }));
  await invalidateCatalog();
  return category;
}

export async function updateCategory(id: number, body: CategoryUpdateBody): Promise<Category> {
  const category = await categoriesRepository
    .update(prisma, id, body)
    .catch((error: unknown) =>
      rethrowDbError(error, { notFound: notFound(), unique: nameTaken() }),
    );
  await invalidateCatalog();
  return category;
}

export async function deleteCategory(id: number): Promise<void> {
  await categoriesRepository.delete(prisma, id).catch((error: unknown) =>
    rethrowDbError(error, {
      notFound: notFound(),
      foreignKey: new ConflictError('CATEGORY_IN_USE', 'La categoría tiene productos asociados.'),
    }),
  );
  await invalidateCatalog();
}
