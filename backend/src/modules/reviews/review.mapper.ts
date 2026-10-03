import type { RatingSummary, Review } from '@sistema-e/contracts';
import type { ReviewRow } from './reviews.repository.js';

export const NO_RATINGS: RatingSummary = { average: null, count: 0 };

// "Ana López" → "Ana L."
export function publicName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const first = words[0] ?? '';
  const initial = words.length > 1 ? [...(words.at(-1) ?? '')][0] : undefined;
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    authorName: publicName(row.user.name),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRatingSummary(count: number, average: number | null): RatingSummary {
  return { average: average === null ? null : Math.round(average * 10) / 10, count };
}
