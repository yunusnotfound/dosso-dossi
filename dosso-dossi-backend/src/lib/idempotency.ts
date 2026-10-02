import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from './errors.js';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key, item]) => key !== 'idempotencyKey' && item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

/** The request row and financial result commit together. Concurrent repeats wait here. */
export async function lockFinancialRequest(
  tx: Prisma.TransactionClient,
  userId: string,
  scope: string,
  key: string | undefined,
  input: unknown,
) {
  if (!key) return null; // Existing clients remain compatible during the rollout.
  const requestHash = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "FinancialRequest" ("id", "userId", "scope", "key", "requestHash", "createdAt")
    VALUES (${randomUUID()}, ${userId}, ${scope}, ${key}, ${requestHash}, NOW())
    ON CONFLICT ("userId", "scope", "key") DO NOTHING
  `);
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "FinancialRequest"
    WHERE "userId" = ${userId} AND "scope" = ${scope} AND "key" = ${key} FOR UPDATE
  `);
  const request = await tx.financialRequest.findUniqueOrThrow({
    where: { userId_scope_key: { userId, scope, key } },
  });
  if (request.requestHash !== requestHash) throw AppError.idempotencyConflict();
  return request;
}

export async function saveFinancialResult(
  tx: Prisma.TransactionClient,
  requestId: string | undefined,
  response: unknown,
  resourceId?: string,
): Promise<void> {
  if (!requestId) return;
  await tx.financialRequest.update({
    where: { id: requestId },
    data: { response: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue, resourceId },
  });
}
