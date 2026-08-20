import type { Request } from 'express';
import { AppError } from '../../lib/errors.js';
import { dec, toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from './audit.js';

export async function listCustomers(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'recent' | 'ltv';
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 25));
  const q = opts.q?.trim();
  const where = q
    ? {
        OR: [
          { phone: { contains: q.replace(/\D/g, '') || ' ' } },
          { name: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        wallet: { select: { balance: true } },
        loyalty: { select: { stamps: true, freeDrinks: true, target: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // LTV: iptal edilmemiş siparişlerin toplamı. Liste sayfası küçük olduğu
  // için sayfadaki kullanıcılar için tek sorguda hesaplanır.
  const ids = rows.map((r) => r.id);
  const spend = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: ids }, status: { not: 'CANCELLED' } },
    _sum: { total: true },
  });
  const byUser = new Map(spend.map((s) => [s.userId, Number(s._sum.total ?? 0)]));

  const customers = rows.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    isBlocked: u.isBlocked,
    balance: toMoney(u.wallet?.balance ?? 0),
    stamps: u.loyalty?.stamps ?? 0,
    target: u.loyalty?.target ?? 5,
    freeDrinks: u.loyalty?.freeDrinks ?? 0,
    orderCount: u._count.orders,
    lifetimeSpend: byUser.get(u.id) ?? 0,
    createdAt: u.createdAt.toISOString(),
  }));

  if (opts.sort === 'ltv') {
    customers.sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
  }
  return { page, pageSize, total, customers };
}

/// 360° müşteri kartı.
export async function customerDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      wallet: true,
      loyalty: true,
      notificationPrefs: true,
    },
  });
  if (!user) throw AppError.notFound('Müşteri bulunamadı');

  const [transactions, orders, events, giftsSent, giftsReceived, charges, sessions] =
    await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: user.wallet?.id ?? '' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { branch: { select: { name: true } } },
      }),
      prisma.loyaltyEvent.findMany({
        where: { accountId: user.loyalty?.id ?? '' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.gift.findMany({
        where: { senderId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.gift.findMany({
        where: { recipientId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.posCharge.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.refreshToken.count({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
    balance: toMoney(user.wallet?.balance ?? 0),
    loyalty: {
      stamps: user.loyalty?.stamps ?? 0,
      target: user.loyalty?.target ?? 5,
      freeDrinks: user.loyalty?.freeDrinks ?? 0,
    },
    activeSessions: sessions,
    notificationPrefs: user.notificationPrefs,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: toMoney(t.amount),
      balanceAfter: toMoney(t.balanceAfter),
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
    orders: orders.map((o) => ({
      id: `DD-${o.number}`,
      status: o.status,
      branchName: o.branch.name,
      total: toMoney(o.total),
      createdAt: o.createdAt.toISOString(),
    })),
    loyaltyEvents: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      createdAt: e.createdAt.toISOString(),
    })),
    giftsSent: giftsSent.map(serializeGift),
    giftsReceived: giftsReceived.map(serializeGift),
    qrCharges: charges.map((c) => ({
      id: c.id,
      amount: toMoney(c.amount),
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

function serializeGift(g: {
  id: string;
  label: string;
  amount: unknown;
  status: string;
  recipientPhone: string;
  createdAt: Date;
}) {
  return {
    id: g.id,
    label: g.label,
    amount: toMoney(g.amount as never),
    status: g.status,
    recipientPhone: g.recipientPhone,
    createdAt: g.createdAt.toISOString(),
  };
}

/// Manuel bakiye düzeltmesi. Bakiye ASLA doğrudan set edilmez: defter
/// kaydı üretilir, gerekçe zorunlu, audit yazılır.
export async function adjustBalance(
  req: Request,
  userId: string,
  amount: number,
  reason: string,
) {
  if (amount === 0) throw AppError.notFound('Tutar sıfır olamaz');
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw AppError.notFound('Cüzdan bulunamadı');

    const before = Number(wallet.balance);
    if (amount < 0 && before + amount < 0) {
      throw AppError.insufficientBalance('Bakiye eksiye düşemez');
    }
    const updated = await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: dec(amount) } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        // İşaretine göre defter tipi: artı düzeltme yükleme, eksi iade gibi
        // görünmesin diye ikisi de nötr bir not taşır.
        type: amount > 0 ? 'TOPUP' : 'ORDER_PAYMENT',
        amount: dec(amount),
        balanceAfter: updated.balance,
        note: `Panel düzeltmesi: ${reason}`,
      },
    });
    await audit(tx, req, {
      action: 'wallet.adjust',
      entity: 'Wallet',
      entityId: wallet.id,
      before: { balance: before },
      after: { balance: Number(updated.balance) },
      reason,
    });
    return { balance: toMoney(updated.balance) };
  });
}

/// Damga ve ikram düzeltmesi (mutlak değer atanır, delta değil —
/// operatör ekranda ne görüyorsa onu yazar).
export async function adjustLoyalty(
  req: Request,
  userId: string,
  input: { stamps?: number; freeDrinks?: number },
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const loyalty = await tx.loyaltyAccount.findUnique({ where: { userId } });
    if (!loyalty) throw AppError.notFound('Sadakat hesabı bulunamadı');

    const stamps =
      input.stamps === undefined
        ? loyalty.stamps
        : Math.min(Math.max(0, input.stamps), loyalty.target - 1);
    const freeDrinks =
      input.freeDrinks === undefined
        ? loyalty.freeDrinks
        : Math.max(0, input.freeDrinks);

    const after = await tx.loyaltyAccount.update({
      where: { userId },
      data: { stamps, freeDrinks },
    });
    await tx.loyaltyEvent.create({
      data: {
        accountId: loyalty.id,
        type: 'ADJUSTMENT',
        title: `Panel düzeltmesi: ${reason}`,
      },
    });
    await audit(tx, req, {
      action: 'loyalty.adjust',
      entity: 'LoyaltyAccount',
      entityId: loyalty.id,
      before: { stamps: loyalty.stamps, freeDrinks: loyalty.freeDrinks },
      after: { stamps, freeDrinks },
      reason,
    });
    return { stamps: after.stamps, freeDrinks: after.freeDrinks };
  });
}

/// Tüm oturumları kapat (çalıntı cihaz, şüpheli erişim).
export async function revokeSessions(req: Request, userId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit(tx, req, {
      action: 'user.revokeSessions',
      entity: 'User',
      entityId: userId,
      after: { revoked: res.count },
      reason,
    });
    return { revoked: res.count };
  });
}

export async function setBlocked(
  req: Request,
  userId: string,
  isBlocked: boolean,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId } });
    if (!before) throw AppError.notFound('Müşteri bulunamadı');
    const after = await tx.user.update({
      where: { id: userId },
      data: { isBlocked },
    });
    // Dondurulan hesabın açık oturumları da düşsün.
    if (isBlocked) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await audit(tx, req, {
      action: isBlocked ? 'user.block' : 'user.unblock',
      entity: 'User',
      entityId: userId,
      before: { isBlocked: before.isBlocked },
      after: { isBlocked },
      reason,
    });
    return { isBlocked: after.isBlocked };
  });
}

/// Bekleyen hediyeler (henüz alıcısına ulaşmamış).
export async function pendingGifts() {
  const rows = await prisma.gift.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { sender: { select: { name: true, phone: true } } },
  });
  return rows.map((g) => ({
    id: g.id,
    label: g.label,
    amount: toMoney(g.amount),
    type: g.type,
    senderName: g.sender.name,
    senderPhone: g.sender.phone,
    recipientPhone: g.recipientPhone,
    createdAt: g.createdAt.toISOString(),
  }));
}
