import type { Prisma } from '@prisma/client';
import { getSetting } from '../settings/settings.service.js';
import { prisma } from '../../lib/prisma.js';
import { normalizePhone } from '../../lib/phone.js';
import { signToken } from '../../middleware/auth.js';
import { claimGiftForUser } from '../gifts/gift-claim.js';
import { consumeOtp, sendOtp } from './otp.service.js';
import { issueRefreshToken } from './refresh.service.js';

export interface AuthResult {
  token: string;
  refreshToken: string;
  user: { phone: string; name: string; email: string };
}

export async function requestOtp(rawPhone: string): Promise<void> {
  await sendOtp(normalizePhone(rawPhone));
}

export async function verifyOtp(rawPhone: string, code: string): Promise<AuthResult> {
  const phone = normalizePhone(rawPhone);
  await consumeOtp(phone, code);

  const { user, refreshToken } = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { phone } });
    if (!user) {
      user = await tx.user.create({
        data: {
          phone,
          wallet: { create: {} },
          loyalty: { create: { target: await getSetting<number>('loyalty.stampTarget', tx) } },
          notificationPrefs: { create: {} },
        },
      });
    }
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    user = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!user.isBlocked) await claimPendingGifts(tx, user.id, phone);
    const refreshToken = await issueRefreshToken(tx, user.id);
    return { user, refreshToken };
  });

  return {
    token: signToken(user.id, user.tokenVersion),
    refreshToken,
    user: { phone: user.phone, name: user.name, email: user.email },
  };
}

/// Telefona gönderilmiş bekleyen hediyeleri kullanıcıya işler.
async function claimPendingGifts(
  tx: Prisma.TransactionClient,
  userId: string,
  phone: string,
): Promise<void> {
  const pending = await tx.gift.findMany({
    where: { recipientPhone: phone, status: 'PENDING' },
  });
  for (const gift of pending) {
    await claimGiftForUser(tx, gift, userId);
  }
}
