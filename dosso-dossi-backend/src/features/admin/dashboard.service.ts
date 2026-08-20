import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';

/// Gün sınırı sunucunun yerel saatine göre; rapor "bugün" derken
/// operasyonun günü kastediliyor (UTC değil).
function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
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
/// QR tahsilatları şubeye bağlı değil (PosCharge'da branch yok), bu yüzden
/// şube filtresi verildiğinde QR cirosu 0 döner ve panelde gizlenir.
export async function summary(branchId?: string): Promise<DashboardSummary> {
  const since = startOfDay();
  const scoped = branchId ? { branchId } : {};

  const [orders, charges, topups, newUsers, loyalty, gifts] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: since }, status: { not: 'CANCELLED' }, ...scoped },
      _sum: { total: true },
      _count: true,
    }),
    branchId
      ? null
      : prisma.posCharge.aggregate({
          // VOIDED tahsilat ciroya sayılmaz
          where: { createdAt: { gte: since }, status: 'APPROVED' },
          _sum: { amount: true },
        }),
    branchId
      ? null
      : prisma.paymentIntent.aggregate({
          where: { confirmedAt: { gte: since }, status: 'SUCCEEDED' },
          _sum: { amount: true },
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
        where: { createdAt: { gte: since }, type: { in: ['REWARD_EARNED', 'TOPUP_BONUS'] } },
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
    freeDrinksGranted,
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
  const rows = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      status: { not: 'CANCELLED' },
      ...(branchId ? { branchId } : {}),
    },
    select: { createdAt: true, total: true },
  });

  const buckets = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(isoDate(d), { revenue: 0, orders: 0 });
  }
  for (const row of rows) {
    const key = isoDate(row.createdAt);
    const b = buckets.get(key);
    if (!b) continue;
    b.revenue += toMoney(row.total);
    b.orders += 1;
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
  const grouped = await prisma.order.groupBy({
    by: ['branchId'],
    where: {
      createdAt: { gte: since },
      status: { not: 'CANCELLED' },
      ...(branchId ? { branchId } : {}),
    },
    _sum: { total: true },
    _count: true,
  });
  const byId = new Map(grouped.map((g) => [g.branchId, g]));

  return branches.map((b) => {
    const g = byId.get(b.id);
    return {
      branchId: b.id,
      name: b.name,
      isOpen: b.isOpen,
      revenue: toMoney(g?._sum.total ?? 0),
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
    const h = r.createdAt.getHours();
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
    prisma.posEvent.count({ where: { status: 'FAILED' } }),
    prisma.branch.findMany({
      where: { isOpen: false, ...(branchId ? { id: branchId } : {}) },
      select: { name: true },
    }),
    prisma.paymentIntent.count({ where: { status: 'PENDING' } }),
  ]);
  return {
    unforwardedOrders: unforwarded,
    failedPosEvents: failed,
    closedBranches: closed.map((b) => b.name),
    pendingPayments: pending,
  };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
