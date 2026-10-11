import { Prisma } from '@prisma/client';

/** Every account mutation locks users in the same order before wallet/loyalty rows. */
export async function lockUsers(tx: Prisma.TransactionClient, userIds: string[]): Promise<void> {
  const ids = [...new Set(userIds)].sort();
  if (ids.length === 0) return;
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "User"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "id" FOR UPDATE
  `);
}
