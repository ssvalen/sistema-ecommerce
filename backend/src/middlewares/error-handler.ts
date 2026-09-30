import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import type { ErrorResponse } from '@sistema-e/contracts';
import { AppError, NotFoundError } from '../errors/app-error.js';
import { classifyDbError, type DbErrorKind } from '../errors/db-errors.js';

interface ErrorReply {
  status: number;
  body: ErrorResponse;
}

function reply(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>[],
): ErrorReply {
  return { status, body: { error: details ? { code, message, details } : { code, message } } };
}

const DB_REPLIES: Record<DbErrorKind, ErrorReply> = {
  unique: reply(409, 'CONFLICT', 'Ya existe un registro con esos datos.'),
  foreignKey: reply(
    409,
    'CONFLICT',
    'La operación hace referencia a un registro inexistente o en uso.',
  ),
  check: reply(409, 'CONFLICT', 'La operación viola una restricción de integridad de los datos.'),
  notFound: reply(404, 'NOT_FOUND', 'El recurso solicitado no existe.'),
  unavailable: reply(
    503,
    'SERVICE_UNAVAILABLE',
    'El servicio no está disponible en este momento. Intenta de nuevo.',
  ),
};

// Errores de body-parser.
function bodyParserReply(error: unknown): ErrorReply | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;
  switch (error.type) {
    case 'entity.parse.failed':
      return reply(400, 'INVALID_JSON', 'El cuerpo de la solicitud no es JSON válido.');
    case 'entity.too.large':
      return reply(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande.');
    case 'encoding.unsupported':
    case 'charset.unsupported':
      return reply(415, 'UNSUPPORTED_MEDIA_TYPE', 'La codificación del cuerpo no es compatible.');
    default:
      return undefined;
  }
}

function uploadReply(error: multer.MulterError): ErrorReply {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return reply(413, 'PAYLOAD_TOO_LARGE', 'La imagen supera el tamaño máximo de 2 MB.');
  }
  return reply(
    400,
    'INVALID_UPLOAD',
    'La carga del archivo no es válida: envía un solo archivo en "image".',
  );
}

function toReply(error: unknown): ErrorReply {
  if (error instanceof AppError)
    return reply(error.status, error.code, error.message, error.details);
  if (error instanceof multer.MulterError) return uploadReply(error);
  const parserReply = bodyParserReply(error);
  if (parserReply) return parserReply;
  const dbKind = classifyDbError(error);
  if (dbKind) return DB_REPLIES[dbKind];
  return reply(500, 'INTERNAL_ERROR', 'Ocurrió un error interno.');
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const { status, body } = toReply(error);
  if (status >= 500) {
    req.log.error({ err: error }, 'Error al procesar la solicitud');
  } else {
    req.log.debug({ code: body.error.code }, 'Solicitud rechazada');
  }
  res.status(status).json(body);
};

export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError('La ruta solicitada no existe.');
};
