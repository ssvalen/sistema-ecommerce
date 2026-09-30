import { Router } from 'express';
import { authenticate, authorize } from '../identity/index.js';
import * as inventory from './inventory.controller.js';
import './inventory.openapi.js';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate, authorize('ADMIN'));
inventoryRouter.get('/', inventory.listInventory);
inventoryRouter.patch('/:productId', inventory.adjustStock);
