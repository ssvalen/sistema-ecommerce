import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const SESSION_COOKIE = 'access_token';

// clearCookie necesita las mismas opciones con que se creó la cookie.
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict',
  path: '/api',
};

export function createSession(res: Response, userId: number): void {
  const token = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: env.JWT_EXPIRES_IN * 1000 });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** Id del usuario de la sesión, o null si no hay token o no es válido. */
export function readSession(req: Request): number | null {
  const token: unknown = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
  if (typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const id = typeof payload === 'string' ? NaN : Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function hasSessionCookie(req: Request): boolean {
  return typeof (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE] === 'string';
}
