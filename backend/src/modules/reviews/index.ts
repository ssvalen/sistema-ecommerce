import type { RatingSummary } from '@sistema-e/contracts';
import type { Db } from '../../db/transaction.js';
import { toRatingSummary } from './review.mapper.js';
import { reviewsRepository } from './reviews.repository.js';

export { NO_RATINGS } from './review.mapper.js';

// Promedio y cantidad por producto, calculados en cada consulta.
export async function ratingSummaries(
  db: Db,
  productIds: number[],
): Promise<Map<number, RatingSummary>> {
  if (productIds.length === 0) return new Map();
  const groups = await reviewsRepository.summarize(db, productIds);
  return new Map(
    groups.map((group) => [group.productId, toRatingSummary(group._count._all, group._avg.rating)]),
  );
}
