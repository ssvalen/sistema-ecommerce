export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>[] | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>[]) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ValidationIssue {
  [key: string]: unknown;
  location: 'body' | 'query' | 'params';
  path: string;
  message: string;
}

export class ValidationError extends AppError {
  constructor(issues: ValidationIssue[]) {
    super(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', issues);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Debes iniciar sesión.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class PaymentDeclinedError extends AppError {
  constructor(message = 'El pago fue rechazado.') {
    super(402, 'PAYMENT_DECLINED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta acción.', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no existe.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>[]) {
    super(409, code, message, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'El servicio no está disponible en este momento. Intenta de nuevo.') {
    super(503, 'SERVICE_UNAVAILABLE', message);
  }
}
