import {
  dataResponse,
  IdParamsSchema,
  LoginBodySchema,
  paginatedResponse,
  PaginationQuerySchema,
  RegisterBodySchema,
  UpdateUserStatusBodySchema,
  UserSchema,
} from '@sistema-e/contracts';
import { errorResponses, registry } from '../../docs/openapi.js';

export const cookieAuth = registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'access_token',
  description: 'Cookie HttpOnly que crea POST /auth/login.',
});

const session = [{ [cookieAuth.name]: [] }];
const json = <T>(schema: T) => ({ 'application/json': { schema } });
const userResponse = { description: 'Usuario', content: json(dataResponse(UserSchema)) };

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Autenticación'],
  summary: 'Registrar un cliente',
  request: { body: { content: json(RegisterBodySchema) } },
  responses: {
    201: { description: 'Cuenta creada', content: json(dataResponse(UserSchema)) },
    ...errorResponses(400, 409),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Autenticación'],
  summary: 'Iniciar sesión',
  description: 'Crea la cookie de sesión `access_token`.',
  request: { body: { content: json(LoginBodySchema) } },
  responses: { 200: userResponse, ...errorResponses(400, 401, 403) },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Autenticación'],
  summary: 'Cerrar sesión',
  description: 'Borra la cookie de sesión.',
  responses: { 204: { description: 'Sesión cerrada' } },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Autenticación'],
  summary: 'Usuario de la sesión',
  security: session,
  responses: { 200: userResponse, ...errorResponses(401, 403) },
});

registry.registerPath({
  method: 'get',
  path: '/users',
  tags: ['Usuarios (admin)'],
  summary: 'Listar usuarios',
  security: session,
  request: { query: PaginationQuerySchema },
  responses: {
    200: { description: 'Usuarios', content: json(paginatedResponse(UserSchema)) },
    ...errorResponses(400, 401, 403),
  },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: ['Usuarios (admin)'],
  summary: 'Consultar un usuario',
  security: session,
  request: { params: IdParamsSchema },
  responses: { 200: userResponse, ...errorResponses(400, 401, 403, 404) },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}/status',
  tags: ['Usuarios (admin)'],
  summary: 'Bloquear o desbloquear un usuario',
  description: 'Un administrador no puede bloquear su propia cuenta.',
  security: session,
  request: { params: IdParamsSchema, body: { content: json(UpdateUserStatusBodySchema) } },
  responses: { 200: userResponse, ...errorResponses(400, 401, 403, 404, 409) },
});
