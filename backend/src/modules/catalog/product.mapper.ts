import type { Product, RatingSummary } from '@sistema-e/contracts';
import type { ProductRow } from './products.repository.js';

export function productImageUrl(product: {
  image: { id: number } | null;
  externalImageUrl: string | null;
}): string | null {
  return product.image ? `/api/v1/images/${product.image.id}` : product.externalImageUrl;
}

export function toProductDto(row: ProductRow, rating: RatingSummary): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price.toFixed(2),
    imageUrl: productImageUrl(row),
    stock: row.stock,
    unitsSold: row.unitsSold,
    rating,
    category: { id: row.category.id, name: row.category.name },
  };
}
