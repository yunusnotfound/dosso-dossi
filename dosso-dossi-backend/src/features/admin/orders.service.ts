import type { OrderStatus, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../../lib/errors.js';
import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { assertExportSize, csvCell, MAX_EXPORT_ROWS } from '../../lib/csv.js';
import { cancelOrderInTransaction, type CancelResult } from '../orders/cancel-order.service.js';
import { advanceOrderStatus, MAX_ORDER_NUMBER } from '../orders/order-status.service.js';
import { audit } from './audit.js';
import { lockUsers } from '../../lib/financial-locks.js';

export interface OrderFilters {
  status?: OrderStatus;
  branchId?: string;
  /// DD-1042, telefon veya isim parçası
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}

export function whereFrom(f: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  const active: OrderStatus[] = ['RECEIVED', 'PREPARING', 'READY'];
  if (f.activeOnly) where.status = { in: f.status ? active.filter((status) => status === f.status) : active };
  else if (f.status) where.status = f.status;
  if (f.branchId) where.branchId = f.branchId;
  if (f.from || f.to) {
    where.createdAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  }
  if (f.q) {
    const q = f.q.trim();
    const num = /^DD-?(\d+)$/i.exec(q)?.[1] ?? (/^\d+$/.test(q) ? q : null);
    // Phone numbers also contain only digits, but cannot fit an Order Int32.
    const number = num === null ? undefined : Number(num);
    const hasOrderNumber = number !== undefined && Number.isInteger(number) && number > 0 && number <= MAX_ORDER_NUMBER;
    where.OR = [
      ...(hasOrderNumber ? [{ number }] : []),
      ...(q.replace(/\D/g, '') ? [{ user: { phone: { contains: q.replace(/\D/g, '') } } }] : []),
      { user: { name: { contains: q, mode: 'insensitive' as const } } },
    ];
  }
  return where;
}

export async function listOrders(f: OrderFilters) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 25));
  const where = whereFrom(f);

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        branch: { select: { name: true } },
        user: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    page,
    pageSize,
    total,
    orders: rows.map((o) => ({
      id: `DD-${o.number}`,
      number: o.number,
      status: o.status,
      branchId: o.branchId,
      branchName: o.branch.name,
      customerName: o.user.name,
      customerPhone: o.user.phone,
      itemCount: o._count.items,
      total: toMoney(o.total),
      usedFreeDrink: o.usedFreeDrink,
      promoCode: o.promoCode,
      forwarded: o.forwardedAt !== null,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export async function getOrderDetail(number: number, branchScope?: string) {
  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      items: true,
      branch: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!order) throw AppError.notFound(`Sipariş bulunamadı: DD-${number}`);
  if (branchScope && order.branchId !== branchScope) {
    throw AppError.forbidden('Bu şubenin siparişi değil');
  }

  // Siparişe bağlı cüzdan hareketleri (ödeme + varsa iade)
  const tx = await prisma.walletTransaction.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'asc' },
  });

  return {
    id: `DD-${order.number}`,
    number: order.number,
    status: order.status,
    pickupSlot: order.pickupSlot,
    branch: order.branch,
    customer: order.user,
    subtotal: toMoney(order.subtotal),
    discount: toMoney(order.discount),
    freeDrinkDiscount: toMoney(order.freeDrinkDiscount),
    total: toMoney(order.total),
    promoCode: order.promoCode,
    usedFreeDrink: order.usedFreeDrink,
    stampsEarned: order.stampsEarned,
    posRef: order.posRef,
    forwardedAt: order.forwardedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      unitPrice: toMoney(i.unitPrice),
      quantity: i.quantity,
      size: i.size,
      milk: i.milk,
      shot: i.shot,
      isFreeDrink: i.isFreeDrink,
    })),
    walletTransactions: tx.map((t) => ({
      id: t.id,
      type: t.type,
      amount: toMoney(t.amount),
      balanceAfter: toMoney(t.balanceAfter),
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/// Durum ilerletme. Kuralları kopyalamaz — Kerzz webhook'uyla aynı
/// advanceOrderStatus'u strict modda çağırır, yani geçersiz geçiş 409 döner.
export async function setStatus(
  req: Request,
  number: number,
  status: OrderStatus,
  branchScope?: string,
): Promise<{ status: string; skipped?: string }> {
  if (status === 'CANCELLED') {
    throw AppError.invalidStatusTransition(
      'İptal için /cancel ucunu kullanın (iade ve sadakat geri alımı gerekir)',
    );
  }
  const order = await prisma.order.findUnique({ where: { number } });
  if (!order) throw AppError.notFound(`Sipariş bulunamadı: DD-${number}`);
  if (branchScope && order.branchId !== branchScope) {
    throw AppError.forbidden('Bu şubenin siparişi değil');
  }

  return prisma.$transaction(async (tx) => {
    // Snapshot the actual predecessor under the same lock as the transition.
    await lockUsers(tx, [order.userId]);
    const before = await tx.order.findUniqueOrThrow({ where: { number } });
    const res = await advanceOrderStatus(tx, number, status, { strict: true });
    if (!res.skipped) {
      await audit(tx, req, {
        action: 'order.status',
        entity: 'Order',
        entityId: order.id,
        before: { status: before.status },
        after: { status },
      });
    }
    return { status: res.status, skipped: res.skipped };
  });
}

export type { CancelResult } from '../orders/cancel-order.service.js';

/// İptal + iade + sadakat geri alımı ve panel denetim kaydı tek transaction.
export async function cancelOrder(
  req: Request,
  number: number,
  reason: string,
  branchScope?: string,
): Promise<CancelResult> {
  return prisma.$transaction(async (tx) => {
    const cancellation = await cancelOrderInTransaction(tx, number, { branchScope });
    if (cancellation.changed) {
      await audit(tx, req, {
        action: 'order.cancel', entity: 'Order', entityId: cancellation.order.id,
        before: cancellation.before, after: cancellation.after, reason,
      });
    }
    return cancellation.result;
  });
}

/// POS'a iletilememiş siparişi elle yeniden iletir (mini-outbox tetiği).
export async function retryForward(req: Request, number: number): Promise<void> {
  const order = await prisma.order.findUnique({ where: { number } });
  if (!order) throw AppError.notFound(`Sipariş bulunamadı: DD-${number}`);
  if (order.forwardedAt) {
    throw AppError.invalidStatusTransition('Sipariş zaten iletilmiş');
  }
  if (order.status !== 'RECEIVED') {
    throw AppError.invalidStatusTransition('Yalnız alınan ve henüz işleme başlanmamış sipariş yeniden iletilebilir');
  }
  const { kerzzPosClient } = await import('../orders/pos-client.js');
  await kerzzPosClient.forwardOrder({
    id: order.id,
    number: order.number,
    branchId: order.branchId,
  });
  await audit(prisma, req, {
    action: 'order.retryForward',
    entity: 'Order',
    entityId: order.id,
  });
}

/// Muhasebe dışa aktarımı. Excel Türkçe yerelde `;` bekler; BOM olmadan
/// Türkçe karakterler bozulur.
export async function exportCsv(f: OrderFilters): Promise<string> {
  const rows = await prisma.order.findMany({
    where: whereFrom(f),
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS + 1,
    include: {
      branch: { select: { name: true } },
      user: { select: { name: true, phone: true } },
    },
  });

  assertExportSize(rows);
  const head = [
    'Sipariş',
    'Tarih',
    'Şube',
    'Müşteri',
    'Telefon',
    'Durum',
    'Ara toplam',
    'İndirim',
    'İkram',
    'Toplam',
    'Promosyon',
    'Damga',
  ];
  const lines = rows.map((o) =>
    [
      `DD-${o.number}`,
      o.createdAt.toISOString(),
      o.branch.name,
      o.user.name,
      o.user.phone,
      o.status,
      toMoney(o.subtotal),
      toMoney(o.discount),
      toMoney(o.freeDrinkDiscount),
      toMoney(o.total),
      o.promoCode ?? '',
      o.stampsEarned,
    ]
      .map(csvCell)
      .join(';'),
  );
  return `﻿${head.join(';')}\n${lines.join('\n')}`;
}
