import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const redis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false, // sin Redis, los comandos fallan de inmediato
  enableReadyCheck: false, // usa INFO, no permitido al usuario ACL
  commandTimeout: 200,
  connectTimeout: 2_000,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
});

const ERROR_LOG_INTERVAL_MS = 30_000;
let lastErrorLoggedAt = 0;

redis.on('error', (error: Error) => {
  const now = Date.now();
  if (now - lastErrorLoggedAt >= ERROR_LOG_INTERVAL_MS) {
    lastErrorLoggedAt = now;
    logger.warn({ err: error.message }, 'Redis no disponible: se continúa sin caché');
  }
});

redis.on('ready', () => {
  logger.info('Redis conectado');
});
