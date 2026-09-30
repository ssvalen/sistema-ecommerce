import { pino } from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { instance: env.INSTANCE_ID },
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    censor: '[redactado]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
