import type { OrderStatus, Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { toMoney } from '../../lib/money.js';
import { journalMetadata, loyaltyState, reverseOrderLoyalty } from '../loyalty/loyalty-journal.js';
import { notifyOrderStatus } from '../notifications/notifications.service.js';

export interface CancelResult {
  refunded: number;
  stampsReverted: number;
  freeDrinkRestored: boolean;
  rewardsRevoked: number;
}

/** Caller owns the transaction: status, refund and loyalty always commit together. */
export async function cancelOrderInTransaction(
  tx: Prisma.TransactionClient,
  number: number,
  opts: { branchScope?: string; allowedStatuses?: OrderStatus[] } = {},
) {
  const initial = await tx.order.findUnique({ where: { number } });
  if (!initial) throw AppError.notFound(`Sipariş bulunamadı: DD-${number}`);
  await lockUsers(tx, [initial.userId]);
  const order = await tx.order.findUniqueOrThrow({ where: { number } });
  if (opts.branchScope && order.branchId !== opts.branchScope) {
    throw AppError.forbidden('Bu şubenin siparişi değil');
  }
  if (order.status === 'CANCELLED') {
    const refund = await tx.walletTransaction.findUnique({
      where: { orderId_type: { orderId: order.id, type: 'REFUND' } },
    });
    if (!refund) throw AppError.invalidStatusTransition('İptalin iade kaydı bulunamadı; işlem incelenmeli');
    return {
      order, changed: false,
      result: {
        refunded: toMoney(refund.amount),
        stampsReverted: order.stampsEarned,
        freeDrinkRestored: order.usedFreeDrink,
        rewardsRevoked: await tx.loyaltyEvent.count({ where: { orderId: order.id, type: 'REWARD_EARNED' } }),
      },
    };
  }
  if (!(opts.allowedStatuses ?? ['RECEIVED', 'PREPARING', 'READY']).includes(order.status)) {
    throw AppError.invalidStatusTransition(
      `DD-${number}: ${order.status} durumundaki sipariş iptal edilemez`,
    );
  }

  // ── Durum ──
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: { in: opts.allowedStatuses ?? ['RECEIVED', 'PREPARING', 'READY'] } },
    data: { status: 'CANCELLED' },
  });
  if (claimed.count !== 1) throw AppError.invalidStatusTransition('Sipariş durumu değişti; yenileyin');

  // ── Para iadesi (defterli, bakiye asla doğrudan set edilmez) ──
  const wallet = await tx.wallet.update({
    where: { userId: order.userId },
    data: { balance: { increment: order.total } },
  });
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'REFUND',
      amount: order.total,
      balanceAfter: wallet.balance,
      orderId: order.id,
      note: `İptal iadesi — DD-${number}`,
    },
  });

  // ── Sadakat geri alımı ──
  // Structured history preserves later gifts/adjustments and target changes.
  // Legacy or unknown history is explicitly marked, never silently guessed into journal events.
  const loyalty = await tx.loyaltyAccount.findUniqueOrThrow({
    where: { userId: order.userId },
  });
  const rewardsFromOrder = await tx.loyaltyEvent.count({
    where: { orderId: order.id, type: 'REWARD_EARNED' },
  });

  const reversal = await reverseOrderLoyalty(tx, loyalty, order);

  await tx.loyaltyAccount.update({
    where: { userId: order.userId },
    data: reversal.state,
  });
  await tx.loyaltyEvent.create({
    data: {
      accountId: loyalty.id,
      type: 'ADJUSTMENT',
      title: `DD-${number} iptal edildi — sadakat geri alındı`,
      orderId: order.id,
      metadata: reversal.mode === 'journal'
        ? journalMetadata({ kind: 'cancel', before: loyaltyState(loyalty), after: reversal.state, orderId: order.id })
        : journalMetadata({ kind: 'checkpoint', before: loyaltyState(loyalty), after: reversal.state, reason: reversal.mode }),
    },
  });

  await notifyOrderStatus(tx, order, 'CANCELLED');
  return {
    order, changed: true,
    before: { status: order.status, stamps: loyalty.stamps, freeDrinks: loyalty.freeDrinks },
    after: {
      status: 'CANCELLED', ...reversal.state,
      loyaltyReversalMode: reversal.mode,
      loyaltyReviewRequired: reversal.mode !== 'journal',
    },
    result: {
      refunded: toMoney(order.total),
      stampsReverted: order.stampsEarned,
      freeDrinkRestored: order.usedFreeDrink,
      rewardsRevoked: rewardsFromOrder,
    },
  };
}
