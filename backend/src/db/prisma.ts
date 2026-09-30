import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { pgSslOption } from './ssl.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  ssl: pgSslOption(env.DB_SSL_MODE),
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

export const prisma = new PrismaClient({ adapter });
