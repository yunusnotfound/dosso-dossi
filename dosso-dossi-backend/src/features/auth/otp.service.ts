import { createHash, randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { smsProvider } from '../../lib/sms/dev-sms-provider.js';

const OTP_TTL_MS = 3 * 60 * 1000;
const SEND_LIMIT = 3; // 10 dakikada en fazla 3 kod
const SEND_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const DEV_MASTER_CODE = '111111';

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export async function sendOtp(phone: string): Promise<void> {
  const recent = await prisma.otpCode.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - SEND_WINDOW_MS) } },
  });
  if (recent >= SEND_LIMIT) {
    throw AppError.rateLimited('Çok fazla kod istendi, lütfen sonra deneyin');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.otpCode.create({
    data: { phone, codeHash: hash(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  await smsProvider.send(
    phone,
    `Dosso Dossi giriş kodunuz: ${code}. 3 dakika geçerlidir.`,
  );
}

/// Kod doğruysa tüketir; değilse INVALID_OTP fırlatır.
export async function consumeOtp(phone: string, code: string): Promise<void> {
  if (env.OTP_DEV_MODE && code === DEV_MASTER_CODE) return;

  const latest = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest || latest.expiresAt < new Date() || latest.attempts >= MAX_ATTEMPTS) {
    throw AppError.invalidOtp();
  }
  if (latest.codeHash !== hash(code)) {
    await prisma.otpCode.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
    });
    throw AppError.invalidOtp();
  }
  await prisma.otpCode.update({
    where: { id: latest.id },
    data: { consumedAt: new Date() },
  });
}
