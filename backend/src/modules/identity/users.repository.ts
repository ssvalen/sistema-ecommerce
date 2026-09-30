import type { Prisma, UserRole, UserStatus } from '../../generated/prisma/client.js';
import type { Db } from '../../db/transaction.js';

// Nunca incluye password_hash.
const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUser }>;

export const usersRepository = {
  findById(db: Db, id: number): Promise<PublicUser | null> {
    return db.user.findUnique({ where: { id }, select: publicUser });
  },

  findByEmail(db: Db, email: string): Promise<PublicUser | null> {
    return db.user.findUnique({ where: { email }, select: publicUser });
  },

  findWithPasswordByEmail(db: Db, email: string) {
    return db.user.findUnique({
      where: { email },
      select: { ...publicUser, passwordHash: true },
    });
  },

  create(
    db: Db,
    data: { name: string; email: string; passwordHash: string; role?: UserRole },
  ): Promise<PublicUser> {
    return db.user.create({ data, select: publicUser });
  },

  list(db: Db, skip: number, take: number): Promise<PublicUser[]> {
    return db.user.findMany({ select: publicUser, orderBy: { id: 'desc' }, skip, take });
  },

  count(db: Db): Promise<number> {
    return db.user.count();
  },

  updateStatus(db: Db, id: number, status: UserStatus): Promise<PublicUser> {
    return db.user.update({ where: { id }, data: { status }, select: publicUser });
  },
};
