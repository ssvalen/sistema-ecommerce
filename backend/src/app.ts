import cookieParser from 'cookie-parser';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { createDocsRouter } from './docs/docs.router.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { httpLogger } from './middlewares/http-logger.js';
import { categoriesRouter, imagesRouter, productsRouter } from './modules/catalog/index.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter, usersRouter } from './modules/identity/index.js';
import { inventoryRouter } from './modules/inventory/index.js';

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

function createApiRouter(): Router {
  const api = Router();
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/categories', categoriesRouter);
  api.use('/products', productsRouter);
  api.use('/images', imagesRouter);
  api.use('/inventory', inventoryRouter);
  return api;
}

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));

  app.use(httpLogger);
  app.use('/api/docs', createDocsRouter());
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/v1', createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
