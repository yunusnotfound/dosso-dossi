import type { LoyaltyAccount, Prisma } from '@prisma/client';
import { z } from 'zod';

const stateSchema = z.object({
  stamps: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  freeDrinks: z.number().int().nonnegative(),
});
export type LoyaltyState = z.infer<typeof stateSchema>;
const base = { version: z.literal(1), before: stateSchema };
const journalSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('purchase'), stampsEarned: z.number().int().nonnegative(), consumeFreeDrink: z.boolean(), nextTarget: z.number().int().positive() }),
  z.object({ ...base, kind: z.literal('grant'), freeDrinks: z.number().int().positive() }),
  z.object({ ...base, kind: z.literal('set'), target: z.number().int().positive(), stamps: z.number().int().nonnegative().optional(), freeDrinks: z.number().int().nonnegative().optional() }),
  z.object({ ...base, kind: z.literal('cancel'), orderId: z.string(), after: stateSchema.optional() }),
  z.object({ ...base, kind: z.literal('checkpoint'), after: stateSchema, reason: z.string() }),
]);
type Journal = z.infer<typeof journalSchema>;
type WithoutVersion<T> = T extends unknown ? Omit<T, 'version'> : never;
export function loyaltyState(account: Pick<LoyaltyAccount, 'stamps' | 'target' | 'freeDrinks'>): LoyaltyState {
  return { stamps: account.stamps, target: account.target, freeDrinks: account.freeDrinks };
}
export function journalMetadata(value: WithoutVersion<Journal>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({ version: 1, ...value })) as Prisma.InputJsonValue;
}

/** Existing cards finish their promised target; overflow starts at the new target. */
export function purchaseState(before: LoyaltyState, stampsEarned: number, consume: boolean, nextTarget: number) {
  const raw = before.stamps + stampsEarned;
  const rewardsEarned = raw >= before.target ? 1 + Math.floor((raw - before.target) / nextTarget) : 0;
  return {
    state: {
      target: rewardsEarned > 0 ? nextTarget : before.target,
      stamps: rewardsEarned > 0 ? (raw - before.target) % nextTarget : raw,
      // Replay cannot reclaim a drink that has already been consumed. Never create negative rights.
      freeDrinks: Math.max(0, before.freeDrinks - (consume ? 1 : 0)) + rewardsEarned,
    }, rewardsEarned,
  };
}

export type ReversalMode = 'journal' | 'legacy' | 'mixed_history';

/** Replay only a fully known journal segment; legacy records are never guessed into events. */
export async function reverseOrderLoyalty(
  tx: Prisma.TransactionClient,
  account: LoyaltyAccount,
  order: { id: string; stampsEarned: number; usedFreeDrink: boolean },
): Promise<{ state: LoyaltyState; mode: ReversalMode }> {
  if (order.stampsEarned === 0 && !order.usedFreeDrink) return { state: loyaltyState(account), mode: 'journal' };
  const events = await tx.loyaltyEvent.findMany({
    where: { accountId: account.id }, orderBy: { sequence: 'asc' },
  });
  const parsed = events.map((event) => ({ event, parsed: journalSchema.safeParse(event.metadata) }));
  const targetIndex = parsed.findIndex(({ event, parsed: entry }) => event.orderId === order.id && entry.success && entry.data.kind === 'purchase');
  const fallback = (mode: ReversalMode) => {
    const total = Math.max(0, account.stamps + account.freeDrinks * account.target
      - order.stampsEarned + (order.usedFreeDrink ? account.target : 0));
    return { state: { stamps: total % account.target, target: account.target, freeDrinks: Math.floor(total / account.target) }, mode };
  };
  if (targetIndex < 0) return fallback('legacy');
  let startIndex = 0;
  // A prior fallback is an explicit boundary. An order before a later boundary cannot be replayed safely.
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i]!.parsed;
    if (entry.success && entry.data.kind === 'checkpoint') {
      if (i > targetIndex) return fallback('mixed_history');
      startIndex = i + 1;
    }
  }
  while (startIndex <= targetIndex && !parsed[startIndex]!.parsed.success) startIndex++;
  const first = parsed[startIndex]?.parsed;
  if (!first?.success) return fallback('mixed_history');
  // Check the recorded timeline independently from the cancellation replay. This
  // catches direct/legacy account changes even when no corresponding event exists.
  // Every known mutation must start from the previous mutation's actual result.
  let recorded = first.data.before;
  const sameState = (a: LoyaltyState, b: LoyaltyState) =>
    a.stamps === b.stamps && a.target === b.target && a.freeDrinks === b.freeDrinks;
  for (const { event, parsed: entry } of parsed.slice(startIndex)) {
    if (!entry.success) {
      if (event.type === 'FREE_DRINK_USED' || event.type === 'REWARD_EARNED') continue;
      return fallback('mixed_history');
    }
    const mutation = entry.data;
    if (!sameState(recorded, mutation.before)) return fallback('mixed_history');
    if (mutation.kind === 'purchase') {
      recorded = purchaseState(recorded, mutation.stampsEarned, mutation.consumeFreeDrink, mutation.nextTarget).state;
    } else if (mutation.kind === 'grant') {
      recorded = { ...recorded, freeDrinks: recorded.freeDrinks + mutation.freeDrinks };
    } else if (mutation.kind === 'set') {
      recorded = {
        target: mutation.target,
        stamps: Math.min(mutation.stamps ?? recorded.stamps, mutation.target - 1),
        freeDrinks: mutation.freeDrinks ?? recorded.freeDrinks,
      };
    } else if (mutation.kind === 'cancel' && mutation.after) {
      recorded = mutation.after;
    } else {
      return fallback('mixed_history');
    }
  }
  if (!sameState(recorded, loyaltyState(account))) return fallback('mixed_history');
  let state = first.data.before;
  const purchaseIds = parsed.slice(startIndex).flatMap(({ event, parsed: entry }) =>
    entry.success && entry.data.kind === 'purchase' && event.orderId ? [event.orderId] : []);
  const cancelled = new Set((await tx.order.findMany({
    where: { id: { in: purchaseIds }, status: 'CANCELLED' }, select: { id: true },
  })).map((row) => row.id));
  cancelled.add(order.id);
  for (const { event, parsed: entry } of parsed.slice(startIndex)) {
    if (!entry.success) {
      // These are display rows for a structured purchase, not separate account mutations.
      if (event.type === 'FREE_DRINK_USED' || event.type === 'REWARD_EARNED') continue;
      return fallback('mixed_history');
    }
    const mutation = entry.data;
    if (mutation.kind === 'checkpoint') return fallback('mixed_history');
    if (mutation.kind === 'cancel') continue; // Cancelled purchases are excluded above.
    if (mutation.kind === 'purchase') {
      if (event.orderId && cancelled.has(event.orderId)) continue;
      state = purchaseState(state, mutation.stampsEarned, mutation.consumeFreeDrink, mutation.nextTarget).state;
    } else if (mutation.kind === 'grant') {
      state = { ...state, freeDrinks: state.freeDrinks + mutation.freeDrinks };
    } else {
      // An explicit operator setting remains absolute, including the displayed card target.
      state = {
        target: mutation.target,
        stamps: Math.min(mutation.stamps ?? state.stamps, mutation.target - 1),
        freeDrinks: mutation.freeDrinks ?? state.freeDrinks,
      };
    }
  }
  return { state, mode: 'journal' };
}
