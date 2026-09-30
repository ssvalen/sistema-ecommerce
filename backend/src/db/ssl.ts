import type { ConnectionOptions } from 'node:tls';

export type DbSslMode = 'disable' | 'require';

// No se usa sslmode en la URL: node-postgres 8 lo trata como verify-full.
export function pgSslOption(mode: DbSslMode): false | ConnectionOptions {
  return mode === 'require' ? { rejectUnauthorized: false } : false;
}
