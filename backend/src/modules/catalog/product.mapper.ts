import type { Product } from '@sistema-e/contracts';
import type { ProductRow } from './products.repository.js';

export function toProductDto(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price.toFixed(2),
    imageUrl: row.image ? `/api/v1/images/${row.image.id}` : row.externalImageUrl,
    stock: row.stock,
    unitsSold: row.unitsSold,
    category: { id: row.category.id, name: row.category.name },
  };
}
