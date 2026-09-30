import { Prisma } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

export type Db = typeof prisma | Prisma.TransactionClient;
export type Tx = Prisma.TransactionClient;

export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 2_000,
    timeout: 10_000, // mayor que lock_timeout (5 s)
  });
}
