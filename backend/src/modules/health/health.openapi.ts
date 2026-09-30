import { dataResponse, HealthSchema } from '@sistema-e/contracts';
import { registry } from '../../docs/openapi.js';

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Salud'],
  summary: 'Estado de la instancia',
  description: 'Instancia que atendió la solicitud y estado de la base de datos y la caché.',
  responses: {
    200: {
      description: 'Estado ok o degraded',
      content: { 'application/json': { schema: dataResponse(HealthSchema) } },
    },
    503: {
      description: 'Estado unavailable: sin base de datos',
      content: { 'application/json': { schema: dataResponse(HealthSchema) } },
    },
  },
});
