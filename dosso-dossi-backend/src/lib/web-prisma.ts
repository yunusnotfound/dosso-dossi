import { PrismaClient } from '@dosso-dossi/web-prisma';
import { env } from '../config/env.js';

let client: PrismaClient | undefined;

/** One lazily initialized pool; never create a Prisma client for each request. */
export function getWebPrisma(): PrismaClient {
  if (!env.WEB_ENABLED) throw new Error('Web modülü etkin değil.');
  client ??= new PrismaClient({ datasourceUrl: env.WEB_DATABASE_URL });
  return client;
}

export async function disconnectWebPrisma(): Promise<void> {
  if (!client) return;
  await client.$disconnect();
  client = undefined;
}
