import type { Request, RequestHandler } from 'express';
import type { UserRole } from '@sistema-e/contracts';
import { prisma } from '../../db/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error.js';
import { clearSession, hasSessionCookie, readSession } from './session.js';
import { usersRepository, type PublicUser } from './users.repository.js';

// El usuario se lee de la base en cada request: un bloqueo tiene efecto inmediato.
export const authenticate: RequestHandler = async (req, res, next) => {
  if (!hasSessionCookie(req)) throw new UnauthorizedError();

  const userId = readSession(req);
  const user = userId === null ? null : await usersRepository.findById(prisma, userId);
  if (!user) {
    clearSession(res);
    throw new UnauthorizedError('Tu sesión expiró o no es válida.', 'SESSION_INVALID');
  }
  if (user.status === 'BLOCKED') {
    clearSession(res);
    throw new ForbiddenError('Tu cuenta está bloqueada.', 'ACCOUNT_BLOCKED');
  }

  req.user = user;
  next();
};

export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(currentUser(req).role)) throw new ForbiddenError();
    next();
  };
}

export function currentUser(req: Request): PublicUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
