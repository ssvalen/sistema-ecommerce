import './zod.js';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  INSTANCE_ID: z.string().min(1).default('api-local'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z.string().min(1).default('loopback'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // require: TLS sin verificar el certificado (autofirmado en las VMs).
  DB_SSL_MODE: z.enum(['disable', 'require']).default('disable'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    // Sin valores: pueden ser secretos.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Configuración inválida:\n${problems}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
