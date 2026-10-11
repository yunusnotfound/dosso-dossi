import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { toMoney } from '../../lib/money.js';
import { lockUsers } from '../../lib/financial-locks.js';
import { assertActiveUser } from '../../lib/active-user.js';
import { AppError } from '../../lib/errors.js';

const QR_TTL_MS = 60 * 1000;

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return { balance: toMoney(wallet.balance), cardLast4: wallet.cardLast4 };
}

// Yükleme akışı iki fazlı yapıya taşındı: payments/topup.service.ts

/// Tara & Öde için tek kullanımlık kod. Yeni kod istenince
/// tüketilmemiş eskiler geçersiz kılınır.
export async function createQrToken(userId: string, session?: { tokenVersion: number; familyId?: string }) {
  return prisma.$transaction(async (tx) => {
    await lockUsers(tx, [userId]);
    await assertActiveUser(tx, userId);
    // Middleware may have passed before a concurrent session revocation.
    // Recheck its snapshot under the same user lock as revokeSessions.
    if (session) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenVersion: true } });
      if (user.tokenVersion !== session.tokenVersion) throw AppError.unauthorized();
      if (session.familyId && !await tx.refreshToken.findFirst({
        where: { userId, familyId: session.familyId, familyRevokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true },
      })) throw AppError.unauthorized();
    }
    const now = new Date();
    const code = `DDPAY-${randomBytes(9).toString('base64url')}`;
    const expiresAt = new Date(now.getTime() + QR_TTL_MS);
    await tx.qrToken.updateMany({
      where: { userId, consumedAt: null },
      // Rotation is an explicit revocation, so the POS expiry grace must not accept it.
      data: { expiresAt: now, consumedAt: now },
    });
    await tx.qrToken.create({ data: { userId, code, expiresAt } });
    return { code, expiresAt: expiresAt.toISOString() };
  });
}
