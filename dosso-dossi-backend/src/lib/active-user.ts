import type { Prisma } from '@prisma/client';
import { AppError } from './errors.js';

/** Must run inside the same transaction as the financial mutation. */
export async function assertActiveUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { isBlocked: true } });
  if (!user) throw AppError.unauthorized();
  if (user.isBlocked) throw AppError.accountBlocked();
}
