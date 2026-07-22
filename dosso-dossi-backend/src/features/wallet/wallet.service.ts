import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { dec, toMoney } from '../../lib/money.js';

// CEO kampanyası: tek seferde 1.000 ₺+ yükleme → 5 ikram kahve
const TOPUP_BONUS_THRESHOLD = 1000;
const TOPUP_BONUS_DRINKS = 5;
const QR_TTL_MS = 60 * 1000;

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return { balance: toMoney(wallet.balance), cardLast4: wallet.cardLast4 };
}

export async function topUp(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: dec(amount) } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'TOPUP',
        amount: dec(amount),
        balanceAfter: wallet.balance,
        note: 'Bakiye yükleme',
      },
    });

    let bonusDrinks = 0;
    if (amount >= TOPUP_BONUS_THRESHOLD) {
      bonusDrinks = TOPUP_BONUS_DRINKS;
      const loyalty = await tx.loyaltyAccount.update({
        where: { userId },
        data: { freeDrinks: { increment: bonusDrinks } },
      });
      await tx.loyaltyEvent.create({
        data: {
          accountId: loyalty.id,
          type: 'TOPUP_BONUS',
          title: `Yükle Kazan — ${bonusDrinks} ikram kahve`,
        },
      });
    }
    return { balance: toMoney(wallet.balance), bonusDrinks };
  });
}

/// Tara & Öde için tek kullanımlık kod. Yeni kod istenince
/// tüketilmemiş eskiler geçersiz kılınır.
export async function createQrToken(userId: string) {
  const code = `DDPAY-${randomBytes(9).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + QR_TTL_MS);
  await prisma.$transaction([
    prisma.qrToken.updateMany({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    }),
    prisma.qrToken.create({ data: { userId, code, expiresAt } }),
  ]);
  return { code, expiresAt: expiresAt.toISOString() };
}
