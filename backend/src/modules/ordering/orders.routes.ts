import { Router } from 'express';
import { authenticate, authorize } from '../identity/index.js';
import * as orders from './orders.controller.js';
import './orders.openapi.js';

export const ordersRouter = Router();
ordersRouter.use(authenticate, authorize('CUSTOMER'));
ordersRouter.post('/', orders.createOrder);
ordersRouter.get('/', orders.listOrders);
ordersRouter.get('/:id', orders.getOrder);
ordersRouter.post('/:id/payment', orders.payOrder);

// Montado en /users/:id/orders.
export const customerOrdersRouter = Router({ mergeParams: true });
customerOrdersRouter.use(authenticate, authorize('ADMIN'));
customerOrdersRouter.get('/', orders.listCustomerOrders);
customerOrdersRouter.get('/:orderId', orders.getCustomerOrder);
