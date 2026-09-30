import type { Health } from '@sistema-e/contracts';
import { redis } from '../../cache/redis.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

const CHECK_TIMEOUT_MS = 1_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Sin respuesta en ${ms} ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

async function isUp(check: () => Promise<unknown>): Promise<'up' | 'down'> {
  try {
    await withTimeout(check(), CHECK_TIMEOUT_MS);
    return 'up';
  } catch {
    return 'down';
  }
}

export async function getHealth(): Promise<Health> {
  const [database, cache] = await Promise.all([
    isUp(() => prisma.$queryRaw`SELECT 1`),
    isUp(() => redis.ping()),
  ]);
  const status = database === 'down' ? 'unavailable' : cache === 'down' ? 'degraded' : 'ok';
  return { status, instance: env.INSTANCE_ID, checks: { database, cache } };
}
