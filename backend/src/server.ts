import { createApp } from './app.js';
import { redis } from './cache/redis.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { logger } from './lib/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();
const server = app.listen(env.PORT, env.HOST, (error?: Error) => {
  if (error) {
    logger.fatal({ err: error }, 'No se pudo iniciar el servidor');
    process.exit(1);
  }
  logger.info({ host: env.HOST, port: env.PORT }, 'API escuchando');
});

// Mayor que el keepalive de NGINX hacia el upstream, para evitar 502.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Apagando la API');

  setTimeout(() => {
    logger.error('Las requests en curso no terminaron a tiempo: se fuerza la salida');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close((error) => {
    void Promise.allSettled([prisma.$disconnect(), redis.quit()]).then(() => {
      process.exit(error ? 1 : 0);
    });
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Promesa rechazada sin manejar');
  process.exit(1);
});
