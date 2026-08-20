import type { Prisma, WalletTxType } from '@prisma/client';
import type { Request } from 'express';
import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { voidCharge } from '../pos/pos.service.js';
import { audit } from './audit.js';

function dayRange(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

/// Cüzdan hareket defteri — tip/tarih filtreli.
export async function ledger(opts: {
  type?: WalletTxType;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, opts.pageSize ?? 50));
  const createdAt = dayRange(opts.from, opts.to);
  const where: Prisma.WalletTransactionWhereInput = {
    ...(opts.type ? { type: opts.type } : {}),
    ...(createdAt ? { createdAt } : {}),
  };

  const [rows, total, sums] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        wallet: { include: { user: { select: { name: true, phone: true } } } },
      },
    }),
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    totalsByType: sums.map((s) => ({
      type: s.type,
      count: s._count,
      amount: toMoney(s._sum.amount ?? 0),
    })),
    entries: rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: toMoney(t.amount),
      balanceAfter: toMoney(t.balanceAfter),
      note: t.note,
      customerName: t.wallet.user.name,
      customerPhone: t.wallet.user.phone,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/// Yükleme (PaymentIntent) listesi — sağlayıcı referanslı.
export async function payments(opts: {
  status?: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  from?: Date;
  to?: Date;
}) {
  const createdAt = dayRange(opts.from, opts.to);
  const rows = await prisma.paymentIntent.findMany({
    where: { ...(opts.status ? { status: opts.status } : {}), ...(createdAt ? { createdAt } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { user: { select: { name: true, phone: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    amount: toMoney(p.amount),
    status: p.status,
    provider: p.provider,
    providerRef: p.providerRef,
    bonusDrinks: p.bonusDrinks,
    customerName: p.user.name,
    customerPhone: p.user.phone,
    createdAt: p.createdAt.toISOString(),
    confirmedAt: p.confirmedAt?.toISOString() ?? null,
  }));
}

/// Kasada QR ile yapılan tahsilatlar.
export async function charges(opts: { from?: Date; to?: Date }) {
  const createdAt = dayRange(opts.from, opts.to);
  const rows = await prisma.posCharge.findMany({
    where: createdAt ? { createdAt } : {},
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { user: { select: { name: true, phone: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    amount: toMoney(c.amount),
    status: c.status,
    saleRef: c.saleRef,
    customerName: c.user.name,
    customerPhone: c.user.phone,
    createdAt: c.createdAt.toISOString(),
  }));
}

/// Panelden void. 15 dakika kuralı ve iade defteri pos.service'te —
/// panel kuralı kopyalamaz, aynı servisi çağırır.
export async function voidChargeFromPanel(
  req: Request,
  chargeId: string,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const result = await voidCharge(tx, chargeId);
    await audit(tx, req, {
      action: 'posCharge.void',
      entity: 'PosCharge',
      entityId: chargeId,
      after: result,
      reason,
    });
    return result;
  });
}

export interface ReconciliationRow {
  date: string;
  ourCount: number;
  ourAmount: number;
  posMatched: number;
  missingSaleRef: number;
}

/// Kerzz mutabakatı: bizim defterimizdeki QR tahsilatlarının kaçının POS
/// tarafında `saleRef` karşılığı var. saleRef boş olanlar eşleşmemiş sayılır
/// ve panelde kırmızı gösterilir (KERZZ_POS_ENTEGRASYON.md'deki açık madde).
export async function reconciliation(days = 7): Promise<ReconciliationRow[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await prisma.posCharge.findMany({
    where: { createdAt: { gte: since }, status: 'APPROVED' },
    select: { createdAt: true, amount: true, saleRef: true },
  });

  const buckets = new Map<string, ReconciliationRow>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      ourCount: 0,
      ourAmount: 0,
      posMatched: 0,
      missingSaleRef: 0,
    });
  }
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.ourCount += 1;
    b.ourAmount = Number((b.ourAmount + toMoney(r.amount)).toFixed(2));
    if (r.saleRef) b.posMatched += 1;
    else b.missingSaleRef += 1;
  }
  return [...buckets.values()];
}

/// Muhasebe dışa aktarımı (Excel-TR uyumlu: BOM + `;`).
export async function ledgerCsv(opts: {
  type?: WalletTxType;
  from?: Date;
  to?: Date;
}): Promise<string> {
  const { entries } = await ledger({ ...opts, pageSize: 200, page: 1 });
  const head = ['Tarih', 'Tip', 'Tutar', 'Bakiye sonrası', 'Müşteri', 'Telefon', 'Not'];
  const lines = entries.map((e) =>
    [
      e.createdAt,
      e.type,
      e.amount,
      e.balanceAfter,
      e.customerName,
      e.customerPhone,
      e.note,
    ]
      .map((v) => {
        const s = String(v);
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(';'),
  );
  return `﻿${head.join(';')}\n${lines.join('\n')}`;
}
