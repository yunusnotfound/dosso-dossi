import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { AdminRole, Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { signAdminToken } from '../../middleware/admin-auth.js';
import { assertTemporaryPasswordActive } from './temporary-password.js';

const REFRESH_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat — panel oturumu kısa

/// Var olmayan e-postada da argon2 doğrulaması yapılsın diye sabit bir
/// hash: yanıt süresinden "bu e-posta kayıtlı mı" bilgisi sızmasın.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$mBP3M0BGZAQZH6HgQdOaBEZ5oR7BLzTLmYNJb1Aq3Qo';

export interface AdminAuthResult {
  token: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
    branchId: string | null;
    mustChangePassword: boolean;
    tempPasswordExpiresAt: string | null;
  };
}

function sha(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function hashPassword(plain: string): Promise<string> {
  return argonHash(plain);
}

export async function login(
  rawEmail: string,
  password: string,
  deviceInfo = '',
): Promise<AdminAuthResult> {
  const email = rawEmail.trim().toLowerCase();
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Kullanıcı yoksa da doğrulama çalıştırılır (zamanlama saldırısına karşı).
  const ok = await argonVerify(admin?.passwordHash ?? DUMMY_HASH, password).catch(
    () => false,
  );
  // Pasif hesap da "geçersiz kimlik" der: hesabın varlığı sızmasın.
  if (!admin || !admin.isActive || !ok) {
    throw AppError.unauthorized('E-posta veya şifre hatalı');
  }
  assertTemporaryPasswordActive(admin);

  const familyId = randomUUID();
  const refreshToken = await prisma.$transaction(async (tx) => {
    const accepted = await tx.adminUser.updateMany({
      where: { id: admin.id, passwordHash: admin.passwordHash, isActive: true, tokenVersion: admin.tokenVersion },
      data: { lastLoginAt: new Date() },
    });
    if (!accepted.count) throw AppError.unauthorized('Hesap bilgileri değişti, yeniden giriş yapın');
    return issueRefreshToken(tx, admin.id, deviceInfo, familyId);
  });

  return {
    token: signAdminToken(admin.id, admin.tokenVersion, familyId),
    refreshToken,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      branchId: admin.branchId,
      mustChangePassword: admin.mustChangePassword,
      tempPasswordExpiresAt: admin.tempPasswordExpiresAt?.toISOString() ?? null,
    },
  };
}

async function issueRefreshToken(
  tx: Prisma.TransactionClient,
  adminId: string,
  deviceInfo = '',
  familyId: string = randomUUID(),
): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  await tx.adminRefreshToken.create({
    data: {
      adminId,
      tokenHash: sha(raw),
      familyId,
      deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return raw;
}

/// Rotasyon; reuse yalnız etkilenen oturum ailesini kapatır.
export async function rotate(
  raw: string,
): Promise<{ token: string; refreshToken: string }> {
  const existing = await prisma.adminRefreshToken.findUnique({
    where: { tokenHash: sha(raw) },
  });
  if (!existing || existing.expiresAt <= new Date() || existing.familyRevokedAt) throw AppError.unauthorized();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${existing.adminId} FOR UPDATE`;
    const current = await tx.adminUser.findUnique({ where: { id: existing.adminId } });
    if (!current?.isActive) throw AppError.unauthorized();
    assertTemporaryPasswordActive(current);
    const token = await tx.adminRefreshToken.findUniqueOrThrow({ where: { id: existing.id } });
    if (token.expiresAt <= new Date() || token.familyRevokedAt) return null;
    if (token.revokedAt) {
      if (existing.revokedAt) {
        const now = new Date();
        await tx.adminRefreshToken.updateMany({
          where: { adminId: existing.adminId, familyId: token.familyId, familyRevokedAt: null },
          data: { revokedAt: now, familyRevokedAt: now },
        });
        logger.warn('Admin refresh token reuse: affected session family revoked');
      }
      return null;
    }
    const newRaw = await issueRefreshToken(tx, existing.adminId, existing.deviceInfo, token.familyId);
    // Guard'lı revoke: eşzamanlı iki rotasyondan yalnız biri geçer.
    const revoked = await tx.adminRefreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
        replacedById: sha(newRaw).slice(0, 16),
      },
    });
    if (revoked.count === 0) throw AppError.unauthorized();
    return { token: signAdminToken(existing.adminId, current.tokenVersion, token.familyId), refreshToken: newRaw };
  });
  if (!result) throw AppError.unauthorized();
  return result;
}

export async function logout(raw: string): Promise<void> {
  const token = await prisma.adminRefreshToken.findUnique({ where: { tokenHash: sha(raw) } });
  if (!token) return;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${token.adminId} FOR UPDATE`;
    const now = new Date();
    await tx.adminRefreshToken.updateMany({
      where: { adminId: token.adminId, familyId: token.familyId, familyRevokedAt: null },
      data: { revokedAt: now, familyRevokedAt: now },
    });
  });
}

/// Bir yöneticinin tüm oturumlarını düşürür (pasifleştirme, şifre sıfırlama).
export async function revokeAllSessions(
  tx: Prisma.TransactionClient,
  adminId: string,
): Promise<void> {
  await tx.adminUser.update({ where: { id: adminId }, data: { tokenVersion: { increment: 1 } } });
  await tx.adminRefreshToken.updateMany({
    where: { adminId, familyRevokedAt: null },
    data: { revokedAt: new Date(), familyRevokedAt: new Date() },
  });
}

/// Şifre değiştirme; mevcut şifre doğrulanır, ardından tüm oturumlar düşer.
export async function changePassword(
  adminId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw AppError.notFound();
  assertTemporaryPasswordActive(admin);
  const ok = await argonVerify(admin.passwordHash, currentPassword).catch(
    () => false,
  );
  if (!ok) throw AppError.unauthorized('Mevcut şifre hatalı');
  if (currentPassword === newPassword) throw new AppError('VALIDATION_ERROR', 400, 'Yeni şifre mevcut şifreden farklı olmalı');

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.adminUser.updateMany({
      where: { id: adminId, passwordHash: admin.passwordHash, tokenVersion: admin.tokenVersion, isActive: true,
        ...(admin.mustChangePassword ? { tempPasswordExpiresAt: { gt: new Date() } } : {}),
      },
      data: { passwordHash, mustChangePassword: false, tempPasswordExpiresAt: null },
    });
    if (!updated.count) throw AppError.unauthorized('Oturum veya şifre değişti; yeniden giriş yapın');
    await revokeAllSessions(tx, adminId);
  });
}

/// Sabit zamanlı karşılaştırma — ileride API anahtarı vb. için hazır.
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
