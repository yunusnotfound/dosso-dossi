import { randomBytes } from 'node:crypto';
import type { AdminRole, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, revokeAllSessions } from './admin-auth.service.js';
import { audit } from './audit.js';

export async function listAdmins() {
  const rows = await prisma.adminUser.findMany({
    orderBy: [{ isActive: 'desc' }, { email: 'asc' }],
    include: { branch: { select: { name: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    branchId: a.branchId,
    branchName: a.branch?.name ?? null,
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
}

/// Yeni yönetici. Şifre üretilip bir kez döner; DB'de yalnız argon2id hash'i.
export async function createAdmin(
  req: Request,
  input: { email: string; name: string; role: AdminRole; branchId?: string | null },
): Promise<{ id: string; tempPassword: string }> {
  const email = input.email.trim().toLowerCase();
  if (input.role === 'BRANCH_MANAGER' && !input.branchId) {
    throw AppError.notFound('Şube müdürü için şube seçilmeli');
  }
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw AppError.invalidPromo('Bu e-posta zaten kayıtlı');

  const tempPassword = randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);

  const created = await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.create({
      data: {
        email,
        name: input.name,
        role: input.role,
        branchId: input.role === 'BRANCH_MANAGER' ? input.branchId : null,
        passwordHash,
      },
    });
    await audit(tx, req, {
      action: 'admin.create',
      entity: 'AdminUser',
      entityId: admin.id,
      after: { email, role: input.role, branchId: admin.branchId },
    });
    return admin;
  });

  return { id: created.id, tempPassword };
}

export async function updateAdmin(
  req: Request,
  id: string,
  input: { name?: string; role?: AdminRole; branchId?: string | null; isActive?: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.adminUser.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Yönetici bulunamadı');

    // Kendini kilitleme koruması: son aktif SUPER_ADMIN düşürülemez.
    const losingSuper =
      before.role === 'SUPER_ADMIN' &&
      ((input.role && input.role !== 'SUPER_ADMIN') || input.isActive === false);
    if (losingSuper) {
      const others = await tx.adminUser.count({
        where: { role: 'SUPER_ADMIN', isActive: true, id: { not: id } },
      });
      if (others === 0) {
        throw AppError.forbidden(
          'Son aktif süper yönetici pasifleştirilemez veya rolü düşürülemez',
        );
      }
    }

    const role = input.role ?? before.role;
    const data: Prisma.AdminUserUpdateInput = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };
    // Şube yalnız BRANCH_MANAGER'da anlamlı; rol değişince temizlenir.
    if (role === 'BRANCH_MANAGER') {
      if (input.branchId !== undefined) {
        data.branch = input.branchId
          ? { connect: { id: input.branchId } }
          : { disconnect: true };
      }
    } else {
      data.branch = { disconnect: true };
    }

    const after = await tx.adminUser.update({ where: { id }, data });
    // Yetki daraldıysa açık oturumlar da düşsün.
    if (input.isActive === false || (input.role && input.role !== before.role)) {
      await revokeAllSessions(tx, id);
    }
    await audit(tx, req, {
      action: 'admin.update',
      entity: 'AdminUser',
      entityId: id,
      before: { role: before.role, branchId: before.branchId, isActive: before.isActive },
      after: { role: after.role, branchId: after.branchId, isActive: after.isActive },
    });
    return { id: after.id };
  });
}

/// Şifre sıfırlama: yeni geçici şifre üretilir, tüm oturumlar düşer.
export async function resetPassword(
  req: Request,
  id: string,
): Promise<{ tempPassword: string }> {
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) throw AppError.notFound('Yönetici bulunamadı');

  const tempPassword = randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id }, data: { passwordHash } });
    await revokeAllSessions(tx, id);
    await audit(tx, req, {
      action: 'admin.resetPassword',
      entity: 'AdminUser',
      entityId: id,
      reason: 'Şifre sıfırlandı',
    });
  });
  return { tempPassword };
}

/// Audit tarayıcısı: kim, ne, ne zaman.
export async function listAudit(opts: {
  adminId?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, opts.pageSize ?? 50));
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.adminId ? { adminId: opts.adminId } : {}),
    ...(opts.entity ? { entity: opts.entity } : {}),
    ...(opts.entityId ? { entityId: opts.entityId } : {}),
    ...(opts.action ? { action: { contains: opts.action } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { admin: { select: { email: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    page,
    pageSize,
    total,
    logs: rows.map((l) => ({
      id: l.id,
      adminEmail: l.admin.email,
      adminName: l.admin.name,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      before: l.before,
      after: l.after,
      reason: l.reason,
      ip: l.ip,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}
