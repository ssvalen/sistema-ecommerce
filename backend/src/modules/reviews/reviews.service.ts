import type { MyReview, PaginationQuery, Review, ReviewBody } from '@sistema-e/contracts';
import { prisma } from '../../db/prisma.js';
import { ForbiddenError, NotFoundError } from '../../errors/app-error.js';
import { isActiveProduct } from '../catalog/index.js';
import { hasCompletedPurchase } from '../ordering/index.js';
import { publicName, toReview } from './review.mapper.js';
import { reviewsRepository } from './reviews.repository.js';

const reviewNotFound = () => new NotFoundError('La reseña no existe.');

async function requireActiveProduct(productId: number): Promise<void> {
  if (!(await isActiveProduct(prisma, productId))) {
    throw new NotFoundError('El producto no existe.');
  }
}

export async function listReviews(
  productId: number,
  { page, pageSize }: PaginationQuery,
): Promise<{ items: Review[]; total: number }> {
  await requireActiveProduct(productId);
  const { rows, total } = await reviewsRepository.listByProduct(
    prisma,
    productId,
    (page - 1) * pageSize,
    pageSize,
  );
  return { items: rows.map(toReview), total };
}

export async function getMyReview(
  user: { id: number; name: string },
  productId: number,
): Promise<MyReview> {
  await requireActiveProduct(productId);
  const [review, purchased] = await Promise.all([
    reviewsRepository.findByUser(prisma, user.id, productId),
    hasCompletedPurchase(prisma, user.id, productId),
  ]);
  return {
    canReview: purchased,
    authorName: publicName(user.name),
    review: review ? toReview(review) : null,
  };
}

// Una reseña por cliente y producto: un segundo envío la reemplaza.
export async function saveMyReview(
  userId: number,
  productId: number,
  body: ReviewBody,
): Promise<{ review: Review; created: boolean }> {
  await requireActiveProduct(productId);
  if (!(await hasCompletedPurchase(prisma, userId, productId))) {
    throw new ForbiddenError('Solo puedes reseñar productos que compraste.', 'REVIEW_NOT_ALLOWED');
  }
  const { id, created } = await reviewsRepository.upsert(prisma, {
    userId,
    productId,
    rating: body.rating,
    comment: body.comment,
  });
  const row = await reviewsRepository.findById(prisma, id);
  if (!row) throw reviewNotFound();
  return { review: toReview(row), created };
}

export async function deleteMyReview(userId: number, productId: number): Promise<void> {
  if (!(await reviewsRepository.deleteByUser(prisma, userId, productId))) {
    throw new NotFoundError('No tienes una reseña de este producto.');
  }
}

export async function deleteReview(id: number): Promise<void> {
  if (!(await reviewsRepository.deleteById(prisma, id))) throw reviewNotFound();
}
