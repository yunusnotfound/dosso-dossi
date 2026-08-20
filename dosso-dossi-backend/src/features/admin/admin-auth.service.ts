import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { AdminRole, Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { signAdminToken } from '../../middleware/admin-auth.js';

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

  const refreshToken = await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    return issueRefreshToken(tx, admin.id, deviceInfo);
  });

  return {
    token: signAdminToken(admin.id),
    refreshToken,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      branchId: admin.branchId,
    },
  };
}

async function issueRefreshToken(
  tx: Prisma.TransactionClient,
  adminId: string,
  deviceInfo = '',
): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  await tx.adminRefreshToken.create({
    data: {
      adminId,
      tokenHash: sha(raw),
      deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return raw;
}

/// Rotasyon; iptal edilmiş token yeniden kullanılırsa (çalıntı şüphesi)
/// yöneticinin TÜM oturumları düşer. Müşteri tarafındaki desenin aynısı.
export async function rotate(
  raw: string,
): Promise<{ token: string; refreshToken: string }> {
  const existing = await prisma.adminRefreshToken.findUnique({
    where: { tokenHash: sha(raw) },
  });
  if (!existing) throw AppError.unauthorized();

  if (existing.revokedAt) {
    logger.warn(
      `Admin refresh token reuse tespit edildi (admin ${existing.adminId}) — tüm oturumlar iptal ediliyor`,
    );
    await prisma.adminRefreshToken.updateMany({
      where: { adminId: existing.adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized();
  }
  if (existing.expiresAt < new Date()) throw AppError.unauthorized();

  // Rolü düşürülen/pasifleştirilen yönetici oturumunu yenileyemesin.
  const admin = await prisma.adminUser.findUnique({
    where: { id: existing.adminId },
  });
  if (!admin?.isActive) throw AppError.unauthorized('Hesap pasif');

  return prisma.$transaction(async (tx) => {
    const newRaw = await issueRefreshToken(tx, existing.adminId, existing.deviceInfo);
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
    return { token: signAdminToken(existing.adminId), refreshToken: newRaw };
  });
}

export async function logout(raw: string): Promise<void> {
  await prisma.adminRefreshToken.updateMany({
    where: { tokenHash: sha(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/// Bir yöneticinin tüm oturumlarını düşürür (pasifleştirme, şifre sıfırlama).
export async function revokeAllSessions(
  tx: Prisma.TransactionClient,
  adminId: string,
): Promise<void> {
  await tx.adminRefreshToken.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
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
  const ok = await argonVerify(admin.passwordHash, currentPassword).catch(
    () => false,
  );
  if (!ok) throw AppError.unauthorized('Mevcut şifre hatalı');

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: adminId }, data: { passwordHash } });
    await revokeAllSessions(tx, adminId);
  });
}

/// Sabit zamanlı karşılaştırma — ileride API anahtarı vb. için hazır.
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
