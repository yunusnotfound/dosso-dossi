import type { Request } from 'express';
import { AppError } from '../../lib/errors.js';
import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from './audit.js';

export async function listBranches(scope?: string) {
  const rows = await prisma.branch.findMany({
    where: scope ? { id: scope } : {},
    orderBy: { name: 'asc' },
    include: { _count: { select: { orders: true } } },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    phone: b.phone,
    lat: Number(b.lat),
    lng: Number(b.lng),
    hours: b.hours,
    isOpen: b.isOpen,
    prepMinutes: b.prepMinutes,
    orderCount: b._count.orders,
  }));
}

export interface BranchInput {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  lat: number;
  lng: number;
  hours: string;
  isOpen?: boolean;
  prepMinutes?: number;
}

export async function upsertBranch(req: Request, input: BranchInput) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.branch.findUnique({ where: { id: input.id } });
    const data = {
      name: input.name,
      address: input.address,
      city: input.city,
      phone: input.phone ?? '',
      lat: input.lat,
      lng: input.lng,
      hours: input.hours,
      isOpen: input.isOpen ?? true,
      prepMinutes: input.prepMinutes ?? 7,
    };
    const after = await tx.branch.upsert({
      where: { id: input.id },
      update: data,
      create: { id: input.id, ...data },
    });
    await audit(tx, req, {
      action: before ? 'branch.update' : 'branch.create',
      entity: 'Branch',
      entityId: after.id,
      before,
      after,
    });
    return after;
  });
}

/// Anlık açık/kapalı. Kapalı şube sipariş alamaz (BRANCH_CLOSED) — kural
/// zaten placeOrder'da; panel yalnızca bayrağı çevirir.
export async function setOpen(req: Request, id: string, isOpen: boolean) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.branch.findUnique({ where: { id } });
    if (!before) throw AppError.notFound('Şube bulunamadı');
    const after = await tx.branch.update({ where: { id }, data: { isOpen } });
    await audit(tx, req, {
      action: isOpen ? 'branch.open' : 'branch.close',
      entity: 'Branch',
      entityId: id,
      before: { isOpen: before.isOpen },
      after: { isOpen },
    });
    return after;
  });
}

/// Şube detayında günün özeti: sipariş sayısı/cirosu ve müsaitlik istisnaları.
export async function branchDetail(id: string) {
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) throw AppError.notFound('Şube bulunamadı');

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [today, unavailable, overrides] = await Promise.all([
    prisma.order.aggregate({
      where: { branchId: id, createdAt: { gte: since }, status: { not: 'CANCELLED' } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.branchProduct.findMany({
      where: { branchId: id, isAvailable: false },
      include: { product: { select: { name: true } } },
    }),
    prisma.branchProduct.findMany({
      where: { branchId: id, priceOverride: { not: null } },
      include: { product: { select: { name: true } } },
    }),
  ]);

  return {
    ...branch,
    lat: Number(branch.lat),
    lng: Number(branch.lng),
    todayOrders: today._count,
    todayRevenue: toMoney(today._sum.total ?? 0),
    unavailableProducts: unavailable.map((u) => ({
      productId: u.productId,
      name: u.product.name,
    })),
    priceOverrides: overrides.map((o) => ({
      productId: o.productId,
      name: o.product.name,
      price: o.priceOverride ? toMoney(o.priceOverride) : null,
    })),
  };
}
