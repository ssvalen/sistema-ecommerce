import type { User } from '@sistema-e/contracts';
import type { PublicUser } from './users.repository.js';

export function toUserDto(user: PublicUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
