import type { Prisma } from '@prisma/client';

/** Lock the phone before any user rows, including when registration has not created a user yet. */
export async function lockRecipientPhone(tx: Prisma.TransactionClient, normalizedPhone: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`recipient:${normalizedPhone}`}, 0))`;
}
