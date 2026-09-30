import { Router } from 'express';
import { handler } from '../../http/handler.js';
import { sendData } from '../../http/responses.js';
import { getHealth } from './health.service.js';
import './health.openapi.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  handler({}, async (_input, _req, res) => {
    const health = await getHealth();
    sendData(res, health, health.status === 'unavailable' ? 503 : 200);
  }),
);
