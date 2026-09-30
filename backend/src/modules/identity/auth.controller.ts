import { LoginBodySchema, RegisterBodySchema } from '@sistema-e/contracts';
import { handler } from '../../http/handler.js';
import { sendData, sendNoContent } from '../../http/responses.js';
import { currentUser } from './auth.middleware.js';
import * as authService from './auth.service.js';
import { clearSession, createSession } from './session.js';
import { toUserDto } from './user.mapper.js';

export const register = handler({ body: RegisterBodySchema }, async ({ body }, _req, res) => {
  sendData(res, await authService.register(body), 201);
});

export const login = handler({ body: LoginBodySchema }, async ({ body }, _req, res) => {
  const user = await authService.login(body);
  createSession(res, user.id);
  sendData(res, user);
});

export const logout = handler({}, (_input, _req, res) => {
  clearSession(res);
  sendNoContent(res);
});

export const me = handler({}, (_input, req, res) => {
  sendData(res, toUserDto(currentUser(req)));
});
