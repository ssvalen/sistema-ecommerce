import { Router } from 'express';
import * as auth from './auth.controller.js';
import { authenticate, authorize } from './auth.middleware.js';
import * as users from './users.controller.js';
import './identity.openapi.js';

export const authRouter = Router();
authRouter.post('/register', auth.register);
authRouter.post('/login', auth.login);
authRouter.post('/logout', auth.logout);
authRouter.get('/me', authenticate, auth.me);

export const usersRouter = Router();
usersRouter.use(authenticate, authorize('ADMIN'));
usersRouter.get('/', users.listUsers);
usersRouter.get('/:id', users.getUser);
usersRouter.patch('/:id/status', users.updateUserStatus);
