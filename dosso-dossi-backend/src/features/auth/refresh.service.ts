import { createHash, randomBytes, randomUUID } from 'node:crypto';
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
  familyId: string = randomUUID(),
): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  await tx.refreshToken.create({
    data: {
      userId,
      tokenHash: hash(raw),
      familyId,
      deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return raw;
}

/// Rotasyon: geçerli refresh token yeni access+refresh çiftiyle değiştirilir.
/// Reuse revokes only the compromised family; expired or repeated incidents
/// can never invalidate an independent login.
export async function rotateRefreshToken(
  raw: string,
): Promise<{ token: string; refreshToken: string }> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash(raw) },
  });
  if (!existing || existing.expiresAt <= new Date() || existing.familyRevokedAt) throw AppError.unauthorized();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${existing.userId} FOR UPDATE`;
    const current = await tx.refreshToken.findUniqueOrThrow({ where: { id: existing.id } });
    if (current.expiresAt <= new Date() || current.familyRevokedAt) return null;
    if (current.revokedAt) {
      // A simultaneous rotation loses its race without revoking the winner.
      if (existing.revokedAt) {
        const now = new Date();
        await tx.refreshToken.updateMany({
          where: { userId: existing.userId, familyId: current.familyId, familyRevokedAt: null },
          data: { revokedAt: now, familyRevokedAt: now },
        });
        logger.warn('Refresh token reuse: affected session family revoked');
      }
      return null;
    }
    const user = await tx.user.findUnique({ where: { id: existing.userId } });
    if (!user || user.closedAt) throw AppError.unauthorized();
    const newRaw = await issueRefreshToken(tx, existing.userId, existing.deviceInfo, current.familyId);
    // Guard'lı revoke: eşzamanlı iki rotasyon isteğinden yalnız biri geçer;
    // guard'sız olsaydı tek token'dan iki geçerli zincir doğardı.
    const revoked = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedById: hash(newRaw).slice(0, 16), // zincir izi (tam hash gerekmez)
      },
    });
    if (revoked.count === 0) throw AppError.unauthorized();
    return { token: signToken(existing.userId, user.tokenVersion, current.familyId), refreshToken: newRaw };
  });
  if (!result) throw AppError.unauthorized();
  return result;
}

/// Çıkışta çağrılır; token bilinmiyorsa sessizce geçer (çıkış her zaman başarılı).
export async function revokeRefreshToken(raw: string): Promise<void> {
  const token = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!token) return;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${token.userId} FOR UPDATE`;
    const now = new Date();
    await tx.refreshToken.updateMany({
      where: { userId: token.userId, familyId: token.familyId, familyRevokedAt: null },
      data: { revokedAt: now, familyRevokedAt: now },
    });
  });
}
