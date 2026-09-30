import { createHash } from 'node:crypto';
import { logger } from '../lib/logger.js';
import { redis } from './redis.js';

const VERSION_KEY = 'catalog:version';

export type CacheStatus = 'HIT' | 'MISS' | 'BYPASS';

async function tryRedis<T>(operation: () => Promise<T>): Promise<T | undefined> {
  try {
    return await operation();
  } catch {
    return undefined;
  }
}

export function cacheKey(name: string, parts: unknown): string {
  const hash = createHash('sha1').update(JSON.stringify(parts)).digest('hex');
  return `${name}:${hash}`;
}

// Sin Redis se lee directo de la base (BYPASS).
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<{ value: T; cache: CacheStatus }> {
  const version = await tryRedis(() => redis.get(VERSION_KEY));
  if (version === undefined) return { value: await load(), cache: 'BYPASS' };

  const fullKey = `catalog:v${version ?? '0'}:${key}`;
  const hit = await tryRedis(() => redis.get(fullKey));
  if (hit) {
    logger.debug({ key: fullKey }, 'caché: acierto');
    return { value: JSON.parse(hit) as T, cache: 'HIT' };
  }

  const value = await load();
  await tryRedis(() => redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds));
  logger.debug({ key: fullKey }, 'caché: fallo');
  return { value, cache: 'MISS' };
}

// Se llama después del COMMIT de cada cambio del admin sobre el catálogo.
export async function invalidateCatalog(): Promise<void> {
  const result = await tryRedis(() => redis.incr(VERSION_KEY));
  if (result === undefined) logger.warn('No se pudo invalidar la caché del catálogo');
}
