import type { Db } from '../../db/transaction.js';
import { usersRepository } from './users.repository.js';

export { authenticate, authorize, currentUser } from './auth.middleware.js';

export async function userExists(db: Db, id: number): Promise<boolean> {
  return (await usersRepository.findById(db, id)) !== null;
}
