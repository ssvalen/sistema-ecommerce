import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../identity/index.js';
import * as catalog from './catalog.controller.js';
import './catalog.openapi.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 },
}).single('image');

const admin = [authenticate, authorize('ADMIN')];

export const categoriesRouter = Router();
categoriesRouter.get('/', catalog.listCategories);
categoriesRouter.get('/:id', catalog.getCategory);
categoriesRouter.post('/', ...admin, catalog.createCategory);
categoriesRouter.patch('/:id', ...admin, catalog.updateCategory);
categoriesRouter.delete('/:id', ...admin, catalog.deleteCategory);

export const productsRouter = Router();
productsRouter.get('/', catalog.listProducts);
productsRouter.get('/:id', catalog.getProduct);
productsRouter.post('/', ...admin, catalog.createProduct);
productsRouter.patch('/:id', ...admin, catalog.updateProduct);
productsRouter.delete('/:id', ...admin, catalog.deleteProduct);
productsRouter.put('/:id/image', ...admin, imageUpload, catalog.uploadProductImage);

export const imagesRouter = Router();
imagesRouter.get('/:id', catalog.getImage);
