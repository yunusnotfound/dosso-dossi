import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

/// Panel oturumunun istek boyunca taşınan kimliği.
export interface AdminContext {
  id: string;
  email: string;
  role: AdminRole;
  /// Yalnız BRANCH_MANAGER için dolu; veri kapsamı bununla daraltılır.
  branchId: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin: AdminContext;
  }
}

/// Müşteri token'ından ayırmak için audience zorunlu. Müşteri token'ı
/// farklı sırla imzalandığı için zaten geçmez; `aud` ikinci bir kilit.
const ADMIN_AUDIENCE = 'admin';

export function signAdminToken(adminId: string): string {
  return jwt.sign({ sub: adminId }, env.ADMIN_JWT_SECRET, {
    audience: ADMIN_AUDIENCE,
    expiresIn: env.ADMIN_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/// Panel oturumu ister; `roles` verilirse rol de kontrol edilir.
/// Yetki her istekte DB'den okunur: rolü düşürülen ya da pasifleştirilen
/// bir yönetici, token'ının ömrü dolmadan yetkisini kaybeder.
export function requireAdmin(...roles: AdminRole[]) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(AppError.unauthorized());
      return;
    }

    let adminId: string;
    try {
      const payload = jwt.verify(header.slice(7), env.ADMIN_JWT_SECRET, {
        audience: ADMIN_AUDIENCE,
      });
      if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        next(AppError.unauthorized());
        return;
      }
      adminId = payload.sub;
    } catch {
      next(AppError.unauthorized('Oturum süresi doldu, yeniden giriş yapın'));
      return;
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive) {
      next(AppError.unauthorized('Hesap pasif veya bulunamadı'));
      return;
    }
    if (roles.length > 0 && !roles.includes(admin.role)) {
      next(AppError.forbidden());
      return;
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      branchId: admin.branchId,
    };
    next();
  };
}

/// Şube kapsamı: BRANCH_MANAGER yalnız kendi şubesini görebilir.
/// İstenen şube yoksa kendi şubesi, varsa yetkisi doğrulanır.
/// Diğer roller için istenen şube olduğu gibi geçer (hepsi = undefined).
export function scopeBranch(
  admin: AdminContext,
  requested?: string,
): string | undefined {
  if (admin.role !== 'BRANCH_MANAGER') return requested;
  if (!admin.branchId) {
    throw AppError.forbidden('Şube müdürüne şube atanmamış');
  }
  if (requested && requested !== admin.branchId) {
    throw AppError.forbidden('Bu şubeye erişim yetkiniz yok');
  }
  return admin.branchId;
}
