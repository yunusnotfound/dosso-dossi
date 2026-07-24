import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { toMoney } from '../../lib/money.js';

const QR_TTL_MS = 60 * 1000;

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return { balance: toMoney(wallet.balance), cardLast4: wallet.cardLast4 };
}

// Yükleme akışı iki fazlı yapıya taşındı: payments/topup.service.ts

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
