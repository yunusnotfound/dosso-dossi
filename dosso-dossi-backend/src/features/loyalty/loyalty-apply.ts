import type { Prisma } from '@prisma/client';

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
  const loyalty = await tx.loyaltyAccount.findUniqueOrThrow({
    where: { userId },
  });

  const rawStamps = loyalty.stamps + opts.stampsEarned;
  const rewardsEarned = Math.floor(rawStamps / loyalty.target);
  await tx.loyaltyAccount.update({
    where: { userId },
    data: {
      stamps: rawStamps % loyalty.target,
      freeDrinks:
        loyalty.freeDrinks + rewardsEarned - (opts.consumeFreeDrink ? 1 : 0),
    },
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
  if (opts.stampsEarned > 0) {
    await tx.loyaltyEvent.create({
      data: {
        accountId: loyalty.id,
        type: 'STAMPS_EARNED',
        title: `${opts.stampsEarned} damga — ${opts.sourceTitle}`,
        orderId: opts.orderId,
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
