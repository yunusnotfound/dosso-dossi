import type { Request } from 'express';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from './audit.js';

// ── Kampanyalar ─────────────────────────────────────────────────────

export async function listCampaigns() {
  return prisma.campaign.findMany({ orderBy: { sortOrder: 'asc' } });
}

export interface CampaignInput {
  id: string;
  title: string;
  badge: string;
  description: string;
  style: 'orange' | 'dark';
  sortOrder: number;
  isActive: boolean;
}

export async function upsertCampaign(req: Request, input: CampaignInput) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.campaign.findUnique({ where: { id: input.id } });
    const after = await tx.campaign.upsert({
      where: { id: input.id },
      update: input,
      create: input,
    });
    await audit(tx, req, {
      action: before ? 'campaign.update' : 'campaign.create',
      entity: 'Campaign',
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

export async function deleteCampaign(req: Request, id: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.campaign.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Kampanya bulunamadı');
    await tx.campaign.delete({ where: { id } });
    await audit(tx, req, {
      action: 'campaign.delete',
      entity: 'Campaign',
      entityId: id,
      before,
    });
  });
}

// ── Promosyon kodları ───────────────────────────────────────────────

/// Kodun kaç siparişte kullanıldığı Order.promoCode'dan sayılır.
export async function listPromos() {
  const [codes, usage] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: { code: 'asc' } }),
    prisma.order.groupBy({
      by: ['promoCode'],
      where: { promoCode: { not: null }, status: { not: 'CANCELLED' } },
      _count: true,
      _sum: { discount: true },
    }),
  ]);
  const byCode = new Map(usage.map((u) => [u.promoCode, u]));

  return codes.map((c) => {
    const u = byCode.get(c.code);
    return {
      code: c.code,
      discountRate: Number(c.discountRate),
      isActive: c.isActive,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      usageCount: u?._count ?? 0,
      totalDiscount: Number(u?._sum.discount ?? 0),
    };
  });
}

export async function upsertPromo(
  req: Request,
  input: {
    code: string;
    discountRate: number;
    isActive: boolean;
    expiresAt?: string | null;
  },
) {
  const code = input.code.trim().toUpperCase();
  if (input.discountRate <= 0 || input.discountRate >= 1) {
    throw AppError.invalidPromo('İndirim oranı 0 ile 1 arasında olmalı (0.10 = %10)');
  }
  return prisma.$transaction(async (tx) => {
    const before = await tx.promoCode.findUnique({ where: { code } });
    const data = {
      discountRate: input.discountRate,
      isActive: input.isActive,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    };
    const after = await tx.promoCode.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    });
    await audit(tx, req, {
      action: before ? 'promo.update' : 'promo.create',
      entity: 'PromoCode',
      entityId: code,
      before,
      after,
    });
    return after;
  });
}

export async function deletePromo(req: Request, code: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.promoCode.findUnique({ where: { code } });
    if (!before) throw AppError.notFound('Promosyon kodu bulunamadı');
    await tx.promoCode.delete({ where: { code } });
    await audit(tx, req, {
      action: 'promo.delete',
      entity: 'PromoCode',
      entityId: code,
      before,
    });
  });
}
