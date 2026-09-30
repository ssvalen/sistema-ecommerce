import type { LoginBody, RegisterBody, User } from '@sistema-e/contracts';
import { prisma } from '../../db/prisma.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../errors/app-error.js';
import { classifyDbError } from '../../errors/db-errors.js';
import { hashPassword, verifyPassword } from './password.js';
import { toUserDto } from './user.mapper.js';
import { usersRepository } from './users.repository.js';

export async function register(input: RegisterBody): Promise<User> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await usersRepository.create(prisma, {
      name: input.name,
      email: input.email,
      passwordHash,
    });
    return toUserDto(user);
  } catch (error) {
    if (classifyDbError(error) === 'unique') {
      throw new ConflictError('EMAIL_TAKEN', 'Ya existe una cuenta con ese email.');
    }
    throw error;
  }
}

export async function login(input: LoginBody): Promise<User> {
  const user = await usersRepository.findWithPasswordByEmail(prisma, input.email);
  const valid = await verifyPassword(user?.passwordHash ?? null, input.password);
  if (!user || !valid) {
    throw new UnauthorizedError('Email o contraseña incorrectos.', 'INVALID_CREDENTIALS');
  }
  if (user.status === 'BLOCKED') {
    throw new ForbiddenError('Tu cuenta está bloqueada.', 'ACCOUNT_BLOCKED');
  }
  return toUserDto(user);
}
