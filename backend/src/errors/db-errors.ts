import { Prisma } from '../generated/prisma/client.js';

export type DbErrorKind = 'unique' | 'foreignKey' | 'check' | 'notFound' | 'unavailable';

const PRISMA_CODES: Record<string, DbErrorKind> = {
  P2002: 'unique',
  P2003: 'foreignKey',
  P2025: 'notFound',
  P1001: 'unavailable', // no se puede alcanzar el servidor
  P1002: 'unavailable', // el servidor no respondió a tiempo
  P1008: 'unavailable', // la operación excedió el tiempo
  P1017: 'unavailable', // el servidor cerró la conexión
  P2024: 'unavailable', // no hubo conexión libre en el pool
  P2028: 'unavailable', // error de la API de transacciones (p. ej., timeout)
  P2034: 'unavailable', // conflicto de escritura o deadlock
};

const SQLSTATE_KINDS: Record<string, DbErrorKind> = {
  '23505': 'unique',
  '23503': 'foreignKey',
  '23514': 'check',
  '55P03': 'unavailable', // lock_timeout
  '57014': 'unavailable', // statement_timeout
  '25P03': 'unavailable', // idle_in_transaction_session_timeout
  '40001': 'unavailable', // serialization_failure
  '40P01': 'unavailable', // deadlock_detected
  '53300': 'unavailable', // too_many_connections
  '57P01': 'unavailable', // admin_shutdown
};

const ADAPTER_UNAVAILABLE_KINDS = new Set([
  'DatabaseNotReachable',
  'ConnectionClosed',
  'SocketTimeout',
  'TooManyConnections',
  'TlsConnectionError',
  'AuthenticationFailed',
  'DatabaseAccessDenied',
  'DatabaseDoesNotExist',
  'TransactionWriteConflict',
]);

interface AdapterCause {
  kind: string;
  originalCode?: string;
  code?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Error original del adaptador pg, dentro de cause o meta.driverAdapterError.
function findAdapterCause(error: unknown, depth = 0): AdapterCause | undefined {
  if (!isRecord(error) || depth > 5) return undefined;
  if (typeof error.kind === 'string') return error as unknown as AdapterCause;
  const meta = isRecord(error.meta) ? error.meta : undefined;
  return (
    findAdapterCause(error.cause, depth + 1) ??
    findAdapterCause(meta?.driverAdapterError, depth + 1)
  );
}

function sqlStateOf(cause: AdapterCause | undefined): string | undefined {
  if (!cause) return undefined;
  if (cause.originalCode) return cause.originalCode;
  return cause.kind === 'postgres' ? cause.code : undefined;
}

function isConnectionRefused(error: unknown): boolean {
  return isRecord(error) && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT');
}

// Relanza el error traducido según su tipo, o el original si no hay traducción.
export function rethrowDbError(
  error: unknown,
  translations: Partial<Record<DbErrorKind, Error>>,
): never {
  const kind = classifyDbError(error);
  throw (kind && translations[kind]) || error;
}

export function classifyDbError(error: unknown): DbErrorKind | undefined {
  if (error instanceof Prisma.PrismaClientInitializationError) return 'unavailable';

  const cause = findAdapterCause(error);
  const sqlState = sqlStateOf(cause);
  if (sqlState) {
    const bySqlState =
      SQLSTATE_KINDS[sqlState] ?? (sqlState.startsWith('08') ? 'unavailable' : undefined);
    if (bySqlState) return bySqlState;
  }
  if (cause && ADAPTER_UNAVAILABLE_KINDS.has(cause.kind)) return 'unavailable';

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return PRISMA_CODES[error.code];
  }
  if (isConnectionRefused(error)) return 'unavailable';
  return undefined;
}
