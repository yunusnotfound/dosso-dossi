import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../middleware/auth.js';

const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 gün

function hash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/// Yeni refresh token üretir; ham değer yalnızca istemciye döner,
/// DB'de sha256'sı saklanır.
export async function issueRefreshToken(
  tx: Prisma.TransactionClient,
  userId: string,
  deviceInfo = '',
): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  await tx.refreshToken.create({
    data: {
      userId,
      tokenHash: hash(raw),
      deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return raw;
}

/// Rotasyon: geçerli refresh token yeni access+refresh çiftiyle değiştirilir.
/// İptal edilmiş bir token yeniden kullanılırsa (çalıntı şüphesi)
/// kullanıcının TÜM refresh token'ları iptal edilir.
export async function rotateRefreshToken(
  raw: string,
): Promise<{ token: string; refreshToken: string }> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash(raw) },
  });
  if (!existing) throw AppError.unauthorized();

  if (existing.revokedAt) {
    logger.warn(
      `Refresh token reuse tespit edildi (user ${existing.userId}) — tüm oturumlar iptal ediliyor`,
    );
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized();
  }
  if (existing.expiresAt < new Date()) throw AppError.unauthorized();

  return prisma.$transaction(async (tx) => {
    const newRaw = await issueRefreshToken(tx, existing.userId, existing.deviceInfo);
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedById: hash(newRaw).slice(0, 16), // zincir izi (tam hash gerekmez)
      },
    });
    return { token: signToken(existing.userId), refreshToken: newRaw };
  });
}

/// Çıkışta çağrılır; token bilinmiyorsa sessizce geçer (çıkış her zaman başarılı).
export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
