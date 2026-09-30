import type { PaginationQuery, User, UserStatus } from '@sistema-e/contracts';
import { prisma } from '../../db/prisma.js';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';
import { rethrowDbError } from '../../errors/db-errors.js';
import { toUserDto } from './user.mapper.js';
import { usersRepository } from './users.repository.js';

const userNotFound = () => new NotFoundError('El usuario no existe.');

export async function listUsers({ page, pageSize }: PaginationQuery) {
  const [users, total] = await Promise.all([
    usersRepository.list(prisma, (page - 1) * pageSize, pageSize),
    usersRepository.count(prisma),
  ]);
  return { items: users.map(toUserDto), total };
}

export async function getUser(id: number): Promise<User> {
  const user = await usersRepository.findById(prisma, id);
  if (!user) throw userNotFound();
  return toUserDto(user);
}

export async function setUserStatus(
  actorId: number,
  id: number,
  status: UserStatus,
): Promise<User> {
  if (id === actorId && status === 'BLOCKED') {
    throw new ConflictError('SELF_BLOCK_NOT_ALLOWED', 'No puedes bloquear tu propia cuenta.');
  }
  const user = await usersRepository
    .updateStatus(prisma, id, status)
    .catch((error: unknown) => rethrowDbError(error, { notFound: userNotFound() }));
  return toUserDto(user);
}
