import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const syncDomains = ['menu', 'branches', 'campaigns', 'loyalty', 'wallet', 'orders'] as const;
export type SyncDomain = (typeof syncDomains)[number];
export type SyncRevisions = Record<SyncDomain, string>;

const globalSources: Record<string, readonly SyncDomain[]> = {
  Product: ['menu'], Category: ['menu'], ProductOption: ['menu'],
  BranchProduct: ['menu', 'branches'], Branch: ['branches'],
  Campaign: ['campaigns'], CampaignStory: ['campaigns'], PromoCode: ['campaigns'],
  Setting: ['campaigns', 'loyalty'],
};

/** Increment durable, bounded counters in the same transaction as the change. */
export async function bumpRevisions(tx: Prisma.TransactionClient, domains: readonly SyncDomain[], userId?: string) {
  // Fixed ordering also prevents deadlocks when transactions affect several domains.
  for (const domain of [...new Set(domains)].sort()) {
    const key = userId ? `user:${userId}:${domain}` : `global:${domain}`;
    await tx.syncRevision.upsert({
      where: { key }, create: { key, version: 1 }, update: { version: { increment: 1 } },
    });
  }
}

/** Audit content stays private; financial changes invalidate only their owner. */
export async function recordAuditRevision(
  tx: Prisma.TransactionClient, input: { entity: string; entityId: string; action: string },
): Promise<void> {
  const global = globalSources[input.entity];
  if (global) { await bumpRevisions(tx, global); return; }
  let owner: { userId: string } | null = null;
  let domains: readonly SyncDomain[] = [];
  switch (input.entity) {
    case 'Wallet':
      owner = await tx.wallet.findUnique({ where: { id: input.entityId }, select: { userId: true } });
      domains = ['wallet']; break;
    case 'LoyaltyAccount':
      owner = await tx.loyaltyAccount.findUnique({ where: { id: input.entityId }, select: { userId: true } });
      domains = ['loyalty']; break;
    case 'PosCharge':
      owner = await tx.posCharge.findUnique({ where: { id: input.entityId }, select: { userId: true } });
      domains = input.action === 'posCharge.void' ? ['wallet', 'loyalty'] : ['wallet']; break;
    case 'Order':
      owner = await tx.order.findUnique({ where: { id: input.entityId }, select: { userId: true } });
      domains = input.action === 'order.cancel' ? ['orders', 'wallet', 'loyalty'] : ['orders']; break;
  }
  if (owner) await bumpRevisions(tx, domains, owner.userId);
}

/** Reads at most twelve primary keys, independent of the audit log's size. */
export async function getSyncRevisions(userId?: string): Promise<SyncRevisions> {
  const keys = syncDomains.flatMap(domain => [
    `global:${domain}`, ...(userId ? [`user:${userId}:${domain}`] : []),
  ]);
  const rows = await prisma.syncRevision.findMany({ where: { key: { in: keys } } });
  const versions = new Map(rows.map(row => [row.key, row.version.toString()]));
  return Object.fromEntries(syncDomains.map(domain => [domain,
    createHash('sha256').update(JSON.stringify([
      'panel-sync-v2', domain, versions.get(`global:${domain}`) ?? '0',
      userId ? versions.get(`user:${userId}:${domain}`) ?? '0' : '0',
    ])).digest('hex'),
  ])) as SyncRevisions;
}
