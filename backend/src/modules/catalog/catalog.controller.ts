import {
  CategoryCreateBodySchema,
  CategoryUpdateBodySchema,
  IdParamsSchema,
  ProductCreateBodySchema,
  ProductListQuerySchema,
  ProductUpdateBodySchema,
} from '@sistema-e/contracts';
import type { Response } from 'express';
import type { CacheStatus } from '../../cache/catalog-cache.js';
import { AppError } from '../../errors/app-error.js';
import { handler } from '../../http/handler.js';
import { paginationMeta, sendData, sendNoContent, sendPaginated } from '../../http/responses.js';
import * as categories from './categories.service.js';
import * as products from './products.service.js';

const setCacheHeader = (res: Response, status: CacheStatus) => res.setHeader('X-Cache', status);

// Categorías

export const listCategories = handler({}, async (_input, _req, res) => {
  const { value, cache } = await categories.listCategories();
  setCacheHeader(res, cache);
  sendData(res, value);
});

export const getCategory = handler({ params: IdParamsSchema }, async ({ params }, _req, res) => {
  sendData(res, await categories.getCategory(params.id));
});

export const createCategory = handler(
  { body: CategoryCreateBodySchema },
  async ({ body }, _req, res) => {
    sendData(res, await categories.createCategory(body), 201);
  },
);

export const updateCategory = handler(
  { params: IdParamsSchema, body: CategoryUpdateBodySchema },
  async ({ params, body }, _req, res) => {
    sendData(res, await categories.updateCategory(params.id, body));
  },
);

export const deleteCategory = handler({ params: IdParamsSchema }, async ({ params }, _req, res) => {
  await categories.deleteCategory(params.id);
  sendNoContent(res);
});

// Productos

export const listProducts = handler(
  { query: ProductListQuerySchema },
  async ({ query }, _req, res) => {
    const { value, cache } = await products.listProducts(query);
    setCacheHeader(res, cache);
    sendPaginated(res, value.items, paginationMeta(query.page, query.pageSize, value.total));
  },
);

export const getProduct = handler({ params: IdParamsSchema }, async ({ params }, _req, res) => {
  sendData(res, await products.getProduct(params.id));
});

export const createProduct = handler(
  { body: ProductCreateBodySchema },
  async ({ body }, _req, res) => {
    sendData(res, await products.createProduct(body), 201);
  },
);

export const updateProduct = handler(
  { params: IdParamsSchema, body: ProductUpdateBodySchema },
  async ({ params, body }, _req, res) => {
    sendData(res, await products.updateProduct(params.id, body));
  },
);

export const deleteProduct = handler({ params: IdParamsSchema }, async ({ params }, _req, res) => {
  await products.deleteProduct(params.id);
  sendNoContent(res);
});

export const uploadProductImage = handler(
  { params: IdParamsSchema },
  async ({ params }, req, res) => {
    if (!req.file) {
      throw new AppError(400, 'IMAGE_REQUIRED', 'Envía la imagen en el campo "image".');
    }
    sendData(res, await products.setProductImage(params.id, req.file.buffer));
  },
);

export const getImage = handler({ params: IdParamsSchema }, async ({ params }, _req, res) => {
  const image = await products.getImage(params.id);
  // El id cambia con cada imagen nueva: la URL nunca cambia de contenido.
  res.setHeader('Content-Type', image.contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Length', String(image.data.byteLength));
  res.end(Buffer.from(image.data));
});
