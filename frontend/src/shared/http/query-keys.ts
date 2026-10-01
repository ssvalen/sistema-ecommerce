import type { ProductListQuery } from '@sistema-e/contracts';

// Compartidas: un módulo invalida datos de otro sin importarlo.
export const queryKeys = {
  session: ['session'] as const,
  categories: ['categories'] as const,
  products: {
    all: ['products'] as const,
    list: (query: ProductListQuery | null) => ['products', 'list', query] as const,
    detail: (id: number | null) => ['products', 'detail', id] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    list: (page: number) => ['inventory', 'list', page] as const,
  },
  cart: ['cart'] as const,
  orders: {
    all: ['orders'] as const,
    lists: ['orders', 'list'] as const,
    list: (page: number) => ['orders', 'list', page] as const,
    detail: (id: number | null) => ['orders', 'detail', id] as const,
    customerList: (userId: number, page: number) =>
      ['orders', 'customer', userId, 'list', page] as const,
    customerDetail: (userId: number | null, orderId: number | null) =>
      ['orders', 'customer', userId, 'detail', orderId] as const,
  },
  users: {
    all: ['users'] as const,
    list: (page: number) => ['users', 'list', page] as const,
    detail: (id: number | null) => ['users', 'detail', id] as const,
  },
};
