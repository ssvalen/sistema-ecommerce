import { Router } from 'express';
import { authenticate, authorize } from '../identity/index.js';
import * as cart from './cart.controller.js';
import './cart.openapi.js';

export const cartRouter = Router();
cartRouter.use(authenticate, authorize('CUSTOMER'));
cartRouter.get('/', cart.getCart);
cartRouter.post('/items', cart.addItem);
cartRouter.patch('/items/:productId', cart.updateItem);
cartRouter.delete('/items/:productId', cart.removeItem);
