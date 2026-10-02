import type { Prisma } from '@prisma/client';
import { lockUsers } from '../../lib/financial-locks.js';
import { AppError } from '../../lib/errors.js';
import { getSetting } from '../settings/settings.service.js';
import { journalMetadata, loyaltyState, purchaseState } from './loyalty-journal.js';

interface ApplyLoyaltyOptions {
  /// Bu işlemle kazanılan damga (ikram edilen içecek dahil — mock ile aynı kural)
  stampsEarned: number;
  /// Doluysa 1 ikram hakkı düşülür ve geçmişe işlenir (title = içecek adı).
  /// Hak kontrolü ÇAĞIRANDA yapılır (ör. sipariş fiyatlamadan önce NO_FREE_DRINK).
  consumeFreeDrink?: { title: string };
  /// Damga geçmişi başlığında görünen kaynak: "Sipariş DD-1042" | "Kasadan satış S123"
  sourceTitle: string;
  orderId?: string;
}

/// Damga/ikram işleme — hem uygulama içi sipariş hem kasadaki satış
/// (Kerzz webhook) aynı kuralı buradan uygular: damga ekle, hedef dolunca
/// damgaları sıfırla + ikram hakkına çevir, geçmiş olaylarını yaz.
export async function applyLoyalty(
  tx: Prisma.TransactionClient,
  userId: string,
  opts: ApplyLoyaltyOptions,
): Promise<{ rewardsEarned: number }> {
  await lockUsers(tx, [userId]);
  const loyalty = await tx.loyaltyAccount.findUniqueOrThrow({
    where: { userId },
  });

  if (opts.consumeFreeDrink && loyalty.freeDrinks < 1) throw AppError.noFreeDrink();
  const nextTarget = await getSetting<number>('loyalty.stampTarget', tx);
  const before = loyaltyState(loyalty);
  const { state, rewardsEarned } = purchaseState(before, opts.stampsEarned, !!opts.consumeFreeDrink, nextTarget);
  await tx.loyaltyAccount.update({
    where: { userId },
    data: state,
  });

  if (opts.consumeFreeDrink) {
    await tx.loyaltyEvent.create({
      data: {
        accountId: loyalty.id,
        type: 'FREE_DRINK_USED',
        title: opts.consumeFreeDrink.title,
        used: true,
        orderId: opts.orderId,
      },
    });
  }
  if (opts.stampsEarned > 0 || opts.consumeFreeDrink) {
    await tx.loyaltyEvent.create({
      data: {
        accountId: loyalty.id,
        type: 'STAMPS_EARNED',
        title: `${opts.stampsEarned} damga — ${opts.sourceTitle}`,
        orderId: opts.orderId,
        metadata: journalMetadata({
          kind: 'purchase', before, stampsEarned: opts.stampsEarned,
          consumeFreeDrink: !!opts.consumeFreeDrink, nextTarget,
        }),
      },
    });
  }
  for (let i = 0; i < rewardsEarned; i++) {
    await tx.loyaltyEvent.create({
      data: {
        accountId: loyalty.id,
        type: 'REWARD_EARNED',
        title: 'Damga kartı tamamlandı — 1 ikram kahve',
        orderId: opts.orderId,
      },
    });
  }

  return { rewardsEarned };
}
