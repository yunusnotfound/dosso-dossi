import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from './errors.js';
import { canonical } from './idempotency.js';

/** The advisory lock, receipt and mutation share one commit or rollback. */
export async function withAdminMutation<T>(
  tx: Prisma.TransactionClient,
  adminId: string,
  scope: string,
  key: string,
  input: unknown,
  mutate: () => Promise<T>,
): Promise<T> {
  const requestHash = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-mutation:${adminId}:${scope}:${key}`}, 0))`;
  const existing = await tx.adminMutationRequest.findUnique({ where: { adminId_scope_key: { adminId, scope, key } } });
  if (existing) {
    if (existing.requestHash !== requestHash) throw AppError.idempotencyConflict();
    return existing.response as T;
  }
  const result = await mutate();
  await tx.adminMutationRequest.create({ data: {
    id: randomUUID(), adminId, scope, key, requestHash,
    response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
  } });
  return result;
}
