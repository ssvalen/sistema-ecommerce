import type { PublicUser } from '../modules/identity/users.repository.js';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};
