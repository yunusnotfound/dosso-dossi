import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { addBusinessDays, businessDayKey, businessHour, startOfBusinessDay } from '../../lib/business-time.js';

const startOfDay = startOfBusinessDay;

function daysAgo(n: number): Date {
  return addBusinessDays(startOfDay(), -n);
}

export interface DashboardSummary {
  orderRevenue: number;
  qrRevenue: number;
  totalRevenue: number;
  orderCount: number;
  topUpTotal: number;
  newUsers: number;
  stampsEarned: number;
  freeDrinksGranted: number;
  pendingGifts: number;
}

/// Bugünün KPI'ları. branchId verilirse yalnız o şube (şube müdürü kapsamı).
export async function summary(branchId?: string): Promise<DashboardSummary> {
  const since = startOfDay();
  const scoped = branchId ? { branchId } : {};

  const [orders, charges, topups, newUsers, loyalty, gifts] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: since }, status: { not: 'CANCELLED' }, ...scoped },
      _sum: { total: true },
      _count: true,
    }),
    prisma.posCharge.aggregate({
      // VOIDED tahsilat ciroya sayılmaz; şube kapsamı siparişlerle aynıdır.
      where: { createdAt: { gte: since }, status: 'APPROVED', ...scoped },
      _sum: { amount: true },
    }),
    branchId
      ? null
      : prisma.paymentIntent.aggregate({
          where: { confirmedAt: { gte: since }, status: 'SUCCEEDED' },
          _sum: { amount: true, bonusDrinks: true },
        }),
    branchId ? null : prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: since }, status: { not: 'CANCELLED' }, ...scoped },
      _sum: { stampsEarned: true },
    }),
    branchId
      ? null
      : prisma.gift.count({ where: { status: 'PENDING' } }),
  ]);

  const freeDrinksGranted = branchId
    ? 0
    : await prisma.loyaltyEvent.count({
        where: { createdAt: { gte: since }, type: 'REWARD_EARNED' },
      });

  const orderRevenue = toMoney(orders._sum.total ?? 0);
  const qrRevenue = toMoney(charges?._sum?.amount ?? 0);

  return {
    orderRevenue,
    qrRevenue,
    totalRevenue: Number((orderRevenue + qrRevenue).toFixed(2)),
    orderCount: orders._count,
    topUpTotal: toMoney(topups?._sum?.amount ?? 0),
    newUsers: newUsers ?? 0,
    stampsEarned: loyalty._sum.stampsEarned ?? 0,
    freeDrinksGranted: freeDrinksGranted + (topups?._sum.bonusDrinks ?? 0),
    pendingGifts: gifts ?? 0,
  };
}

export interface TimeseriesPoint {
  date: string; // "2026-08-19"
  revenue: number;
  orders: number;
}

/// Son N günün günlük cirosu/sipariş sayısı. Boş günler 0 ile doldurulur ki
/// grafik zamanı doğru ölçeklesin.
export async function timeseries(
  days = 30,
  branchId?: string,
): Promise<TimeseriesPoint[]> {
  const since = daysAgo(days - 1);
  const scoped = branchId ? { branchId } : {};
  const [rows, charges] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: 'CANCELLED' }, ...scoped },
      select: { createdAt: true, total: true },
    }),
    prisma.posCharge.findMany({
      where: { createdAt: { gte: since }, status: 'APPROVED', ...scoped },
      select: { createdAt: true, amount: true },
    }),
  ]);

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = addBusinessDays(since, i);
    buckets.set(isoDate(d), { revenue: 0, orders: 0 });
  }
  for (const row of rows) {
    const key = isoDate(row.createdAt);
    const b = buckets.get(key);
    if (!b) continue;
    b.revenue += toMoney(row.total);
    b.orders += 1;
  }
  for (const charge of charges) {
    const b = buckets.get(isoDate(charge.createdAt));
    if (b) b.revenue += toMoney(charge.amount);
  }
  return [...buckets.entries()].map(([date, b]) => ({
    date,
    revenue: Number(b.revenue.toFixed(2)),
    orders: b.orders,
  }));
}

export interface BranchStat {
  branchId: string;
  name: string;
  isOpen: boolean;
  revenue: number;
  orders: number;
}

/// Şube karşılaştırması (bugün). Şube müdürü yalnız kendi satırını görür.
export async function branchStats(branchId?: string): Promise<BranchStat[]> {
  const since = startOfDay();
  const branches = await prisma.branch.findMany({
    where: branchId ? { id: branchId } : {},
    orderBy: { name: 'asc' },
  });
  const scoped = branchId ? { branchId } : {};
  const [grouped, charges] = await Promise.all([
    prisma.order.groupBy({
      by: ['branchId'],
      where: { createdAt: { gte: since }, status: { not: 'CANCELLED' }, ...scoped },
      _sum: { total: true },
      _count: true,
    }),
    prisma.posCharge.groupBy({
      by: ['branchId'],
      where: { createdAt: { gte: since }, status: 'APPROVED', ...scoped },
      _sum: { amount: true },
    }),
  ]);
  const byId = new Map(grouped.map((g) => [g.branchId, g]));
  const chargesById = new Map(charges.map((g) => [g.branchId, toMoney(g._sum.amount ?? 0)]));

  return branches.map((b) => {
    const g = byId.get(b.id);
    return {
      branchId: b.id,
      name: b.name,
      isOpen: b.isOpen,
      revenue: Number((toMoney(g?._sum.total ?? 0) + (chargesById.get(b.id) ?? 0)).toFixed(2)),
      orders: g?._count ?? 0,
    };
  });
}

export interface HourlyPoint {
  hour: number; // 0-23
  orders: number;
}

/// Bugünün saatlik yoğunluğu — vardiya planlaması için.
export async function hourly(branchId?: string): Promise<HourlyPoint[]> {
  const rows = await prisma.order.findMany({
    where: {
      createdAt: { gte: startOfDay() },
      status: { not: 'CANCELLED' },
      ...(branchId ? { branchId } : {}),
    },
    select: { createdAt: true },
  });
  const counts: number[] = new Array<number>(24).fill(0);
  for (const r of rows) {
    const h = businessHour(r.createdAt);
    counts[h] = (counts[h] ?? 0) + 1;
  }
  return counts.map((orders, hour) => ({ hour, orders }));
}

export interface Alerts {
  unforwardedOrders: number;
  failedPosEvents: number;
  closedBranches: string[];
  pendingPayments: number;
}

/// "Dikkat" şeridi: operasyonun anında görmesi gereken aksaklıklar.
export async function alerts(branchId?: string): Promise<Alerts> {
  const scoped = branchId ? { branchId } : {};
  const [unforwarded, failed, closed, pending] = await Promise.all([
    // Mini-outbox: POS'a iletilememiş, iptal edilmemiş siparişler
    prisma.order.count({
      where: { forwardedAt: null, status: { not: 'CANCELLED' }, ...scoped },
    }),
    branchId ? 0 : prisma.posEvent.count({ where: { status: 'FAILED' } }),
    prisma.branch.findMany({
      where: { isOpen: false, ...(branchId ? { id: branchId } : {}) },
      select: { name: true },
    }),
    branchId ? 0 : prisma.paymentIntent.count({ where: { status: 'PENDING' } }),
  ]);
  return {
    unforwardedOrders: unforwarded,
    failedPosEvents: failed,
    closedBranches: closed.map((b) => b.name),
    pendingPayments: pending,
  };
}

const isoDate = businessDayKey;
