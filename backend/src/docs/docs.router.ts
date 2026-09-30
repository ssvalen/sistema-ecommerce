import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi.js';

export function createDocsRouter(): Router {
  const document = buildOpenApiDocument();
  const router = Router();

  // Swagger UI necesita estilos inline.
  router.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
        },
      },
    }),
  );
  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });
  router.use('/', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'Sistema E · API' }));

  return router;
}
