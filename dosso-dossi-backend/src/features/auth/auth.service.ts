import { randomUUID } from 'node:crypto';
import { getSetting } from '../settings/settings.service.js';
import { prisma } from '../../lib/prisma.js';
import { normalizePhone } from '../../lib/phone.js';
import { lockRecipientPhone } from '../../lib/phone-lock.js';
import { AppError } from '../../lib/errors.js';
import { signToken } from '../../middleware/auth.js';
import { claimPendingGiftsForUser } from '../gifts/gift-claim.js';
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

  const { user, refreshToken, familyId } = await prisma.$transaction(async (tx) => {
    await lockRecipientPhone(tx, phone);
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
    if (user.closedAt) throw AppError.unauthorized('Hesap kapatılmış. Destek ile iletişime geçin.');
    if (!user.isBlocked) await claimPendingGiftsForUser(tx, user.id, phone);
    const familyId = randomUUID();
    const refreshToken = await issueRefreshToken(tx, user.id, '', familyId);
    return { user, refreshToken, familyId };
  });

  return {
    token: signToken(user.id, user.tokenVersion, familyId),
    refreshToken,
    user: { phone: user.phone, name: user.name, email: user.email },
  };
}
