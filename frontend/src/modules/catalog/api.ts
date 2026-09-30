import type {
  Category,
  CategoryCreateBody,
  CategoryUpdateBody,
  Product,
  ProductCreateBody,
  ProductListQuery,
  ProductUpdateBody,
} from '@sistema-e/contracts';
import { http } from '@/shared/http/api-client';

export const productsApi = {
  list: (query: ProductListQuery, signal?: AbortSignal) =>
    http.page<Product>('/products', { query, signal }),
  get: (id: number, signal?: AbortSignal) => http.get<Product>(`/products/${id}`, { signal }),
  create: (body: ProductCreateBody) => http.post<Product>('/products', body),
  update: (id: number, body: ProductUpdateBody) => http.patch<Product>(`/products/${id}`, body),
  remove: (id: number) => http.delete(`/products/${id}`),
  uploadImage: (id: number, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return http.put<Product>(`/products/${id}/image`, form);
  },
};

export const categoriesApi = {
  list: (signal?: AbortSignal) => http.get<Category[]>('/categories', { signal }),
  create: (body: CategoryCreateBody) => http.post<Category>('/categories', body),
  update: (id: number, body: CategoryUpdateBody) => http.patch<Category>(`/categories/${id}`, body),
  remove: (id: number) => http.delete(`/categories/${id}`),
};
