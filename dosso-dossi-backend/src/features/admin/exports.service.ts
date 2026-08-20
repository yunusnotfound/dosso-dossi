import type { WalletTxType } from '@prisma/client';
import { toMoney } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import type { OrderFilters } from './orders.service.js';
import { buildWorkbook, type SheetSpec } from './xlsx.js';

const TX_LABEL: Record<string, string> = {
  TOPUP: 'Yükleme',
  ORDER_PAYMENT: 'Sipariş ödemesi',
  GIFT_SENT: 'Hediye gönderimi',
  GIFT_RECEIVED: 'Hediye alımı',
  QR_PAYMENT: 'QR ödemesi',
  REFUND: 'İade',
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Alındı',
  PREPARING: 'Hazırlanıyor',
  READY: 'Hazır',
  COMPLETED: 'Teslim edildi',
  CANCELLED: 'İptal',
};

interface LedgerRow {
  createdAt: Date;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string;
  customerName: string;
  customerPhone: string;
}

/// Cüzdan defteri çalışma kitabı: "Özet" + tip başına birer sayfa + "Tüm
/// hareketler". Tipe göre ayrı sayfa, muhasebenin en çok istediği kırılım.
export async function ledgerWorkbook(opts: {
  type?: WalletTxType;
  from?: Date;
  to?: Date;
}): Promise<Buffer> {
  const where = {
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.from || opts.to
      ? {
          createdAt: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.walletTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: { wallet: { include: { user: { select: { name: true, phone: true } } } } },
  });

  const data: LedgerRow[] = rows.map((t) => ({
    createdAt: t.createdAt,
    type: t.type,
    amount: toMoney(t.amount),
    balanceAfter: toMoney(t.balanceAfter),
    note: t.note,
    customerName: t.wallet.user.name,
    customerPhone: t.wallet.user.phone,
  }));

  const columns = [
    { header: 'Tarih', width: 20, format: 'date' as const, value: (r: LedgerRow) => r.createdAt },
    { header: 'İşlem tipi', width: 20, value: (r: LedgerRow) => TX_LABEL[r.type] ?? r.type },
    { header: 'Müşteri', width: 24, value: (r: LedgerRow) => r.customerName || '—' },
    { header: 'Telefon', width: 16, value: (r: LedgerRow) => r.customerPhone },
    { header: 'Açıklama', width: 34, value: (r: LedgerRow) => r.note },
    {
      header: 'Tutar',
      width: 16,
      format: 'signedMoney' as const,
      value: (r: LedgerRow) => r.amount,
    },
    {
      header: 'Sonraki bakiye',
      width: 18,
      format: 'money' as const,
      value: (r: LedgerRow) => r.balanceAfter,
    },
  ];

  // ── Özet sayfası: tip başına adet ve tutar ──
  const byType = new Map<string, { count: number; amount: number }>();
  for (const r of data) {
    const cur = byType.get(r.type) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount = Number((cur.amount + r.amount).toFixed(2));
    byType.set(r.type, cur);
  }
  const summaryRows = [...byType.entries()].map(([type, v]) => ({
    type,
    count: v.count,
    amount: v.amount,
  }));

  const net = Number(data.reduce((s, r) => s + r.amount, 0).toFixed(2));

  const sheets: SheetSpec<never>[] = [
    {
      name: 'Özet',
      summary: [
        { label: 'Toplam hareket', value: data.length, format: 'int' },
        { label: 'Net tutar', value: net, format: 'signedMoney' },
      ],
      columns: [
        { header: 'İşlem tipi', width: 24, value: (r: (typeof summaryRows)[number]) => TX_LABEL[r.type] ?? r.type },
        { header: 'Adet', width: 12, format: 'int', value: (r: (typeof summaryRows)[number]) => r.count },
        { header: 'Tutar', width: 18, format: 'signedMoney', value: (r: (typeof summaryRows)[number]) => r.amount },
      ],
      rows: summaryRows,
    } as unknown as SheetSpec<never>,
    {
      name: 'Tüm hareketler',
      columns,
      rows: data,
    } as unknown as SheetSpec<never>,
  ];

  // Tip başına ayrı sayfa (yalnız kaydı olanlar; Excel sayfa adı 31 karakter)
  for (const [type, v] of byType) {
    if (v.count === 0) continue;
    sheets.push({
      name: (TX_LABEL[type] ?? type).slice(0, 31),
      columns,
      rows: data.filter((r) => r.type === type),
      summary: [
        { label: 'Adet', value: v.count, format: 'int' },
        { label: 'Tutar', value: v.amount, format: 'signedMoney' },
      ],
    } as unknown as SheetSpec<never>);
  }

  return buildWorkbook('Cüzdan Defteri', sheets);
}

interface OrderExportRow {
  number: number;
  createdAt: Date;
  branchName: string;
  customerName: string;
  customerPhone: string;
  status: string;
  subtotal: number;
  discount: number;
  freeDrinkDiscount: number;
  total: number;
  promoCode: string;
  stampsEarned: number;
}

/// Sipariş çalışma kitabı: "Özet" (şube kırılımı) + "Siparişler" + "Kalemler".
export async function ordersWorkbook(f: OrderFilters): Promise<Buffer> {
  const where = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.branchId ? { branchId: f.branchId } : {}),
    ...(f.from || f.to
      ? {
          createdAt: {
            ...(f.from ? { gte: f.from } : {}),
            ...(f.to ? { lte: f.to } : {}),
          },
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      branch: { select: { name: true } },
      user: { select: { name: true, phone: true } },
      items: true,
    },
  });

  const data: OrderExportRow[] = orders.map((o) => ({
    number: o.number,
    createdAt: o.createdAt,
    branchName: o.branch.name,
    customerName: o.user.name,
    customerPhone: o.user.phone,
    status: o.status,
    subtotal: toMoney(o.subtotal),
    discount: toMoney(o.discount),
    freeDrinkDiscount: toMoney(o.freeDrinkDiscount),
    total: toMoney(o.total),
    promoCode: o.promoCode ?? '',
    stampsEarned: o.stampsEarned,
  }));

  const itemRows = orders.flatMap((o) =>
    o.items.map((i) => ({
      order: `DD-${o.number}`,
      createdAt: o.createdAt,
      branchName: o.branch.name,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: toMoney(i.unitPrice),
      lineTotal: Number((toMoney(i.unitPrice) * i.quantity).toFixed(2)),
      options: [i.size, i.milk, i.shot].filter(Boolean).join(' · '),
      isFreeDrink: i.isFreeDrink ? 'İkram' : '',
    })),
  );

  // Şube kırılımı (iptaller hariç)
  const byBranch = new Map<string, { count: number; revenue: number }>();
  for (const o of data) {
    if (o.status === 'CANCELLED') continue;
    const cur = byBranch.get(o.branchName) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue = Number((cur.revenue + o.total).toFixed(2));
    byBranch.set(o.branchName, cur);
  }
  const branchRows = [...byBranch.entries()].map(([name, v]) => ({ name, ...v }));
  const revenue = Number(branchRows.reduce((s, b) => s + b.revenue, 0).toFixed(2));

  const sheets: SheetSpec<never>[] = [
    {
      name: 'Özet',
      summary: [
        { label: 'Sipariş adedi', value: data.length, format: 'int' },
        { label: 'Toplam ciro (iptaller hariç)', value: revenue, format: 'money' },
      ],
      columns: [
        { header: 'Şube', width: 30, value: (r: (typeof branchRows)[number]) => r.name },
        { header: 'Sipariş', width: 12, format: 'int', value: (r: (typeof branchRows)[number]) => r.count },
        { header: 'Ciro', width: 18, format: 'money', value: (r: (typeof branchRows)[number]) => r.revenue },
      ],
      rows: branchRows,
    } as unknown as SheetSpec<never>,
    {
      name: 'Siparişler',
      columns: [
        { header: 'Sipariş', width: 14, value: (r: OrderExportRow) => `DD-${r.number}` },
        { header: 'Tarih', width: 20, format: 'date', value: (r: OrderExportRow) => r.createdAt },
        { header: 'Şube', width: 26, value: (r: OrderExportRow) => r.branchName },
        { header: 'Müşteri', width: 24, value: (r: OrderExportRow) => r.customerName || '—' },
        { header: 'Telefon', width: 16, value: (r: OrderExportRow) => r.customerPhone },
        { header: 'Durum', width: 16, value: (r: OrderExportRow) => STATUS_LABEL[r.status] ?? r.status },
        { header: 'Ara toplam', width: 16, format: 'money', value: (r: OrderExportRow) => r.subtotal },
        { header: 'İndirim', width: 14, format: 'money', value: (r: OrderExportRow) => r.discount },
        { header: 'İkram', width: 14, format: 'money', value: (r: OrderExportRow) => r.freeDrinkDiscount },
        { header: 'Toplam', width: 16, format: 'money', value: (r: OrderExportRow) => r.total },
        { header: 'Promosyon', width: 14, value: (r: OrderExportRow) => r.promoCode },
        { header: 'Damga', width: 10, format: 'int', value: (r: OrderExportRow) => r.stampsEarned },
      ],
      rows: data,
    } as unknown as SheetSpec<never>,
    {
      name: 'Kalemler',
      columns: [
        { header: 'Sipariş', width: 14, value: (r: (typeof itemRows)[number]) => r.order },
        { header: 'Tarih', width: 20, format: 'date', value: (r: (typeof itemRows)[number]) => r.createdAt },
        { header: 'Şube', width: 26, value: (r: (typeof itemRows)[number]) => r.branchName },
        { header: 'Ürün', width: 30, value: (r: (typeof itemRows)[number]) => r.productName },
        { header: 'Seçenekler', width: 26, value: (r: (typeof itemRows)[number]) => r.options },
        { header: 'Adet', width: 10, format: 'int', value: (r: (typeof itemRows)[number]) => r.quantity },
        { header: 'Birim', width: 14, format: 'money', value: (r: (typeof itemRows)[number]) => r.unitPrice },
        { header: 'Satır', width: 14, format: 'money', value: (r: (typeof itemRows)[number]) => r.lineTotal },
        { header: 'Not', width: 12, value: (r: (typeof itemRows)[number]) => r.isFreeDrink },
      ],
      rows: itemRows,
    } as unknown as SheetSpec<never>,
  ];

  return buildWorkbook('Sipariş Raporu', sheets);
}
