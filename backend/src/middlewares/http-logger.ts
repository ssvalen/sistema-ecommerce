import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

const VALID_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

// X-Request-ID: lo genera NGINX en las VMs y la API en desarrollo.
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-ID', id);
    return id;
  },
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  // Omite el error sintético de pino-http; el real lo registra errorHandler.
  customErrorObject: (_req, _res, _error, loggable: Record<string, unknown>) => {
    const { err: _syntheticError, ...rest } = loggable;
    return rest;
  },
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
