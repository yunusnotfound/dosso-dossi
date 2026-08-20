import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../api/client';
import type { Alerts, DashboardResponse } from '../../api/types';
import {
  Badge,
  Card,
  EmptyState,
  Kpi,
  SectionTitle,
  Spinner,
  fmtDayShort,
  fmtNum,
  fmtTL,
} from '../../components/ui';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardResponse>('/admin/dashboard?days=30'),
    // Operasyon panosu: sekme açıkken canlı kalsın.
    refetchInterval: 60_000,
  });

  if (isLoading) return <Spinner />;
  if (error || !data) {
    return <EmptyState>Panel verisi yüklenemedi. Sayfayı yenileyin.</EmptyState>;
  }

  const { summary, timeseries, branches, hourly, alerts } = data;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-[family-name:--font-display] text-3xl font-extrabold text-ink">
          Panel
        </h1>
        <p className="text-sm text-ink-muted">
          {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'full' }).format(new Date())}
        </p>
      </header>

      <AlertStrip alerts={alerts} />

      <section>
        <SectionTitle>Bugün</SectionTitle>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi
            label="Ciro"
            value={fmtTL(summary.totalRevenue)}
            hint={`Sipariş ${fmtTL(summary.orderRevenue)} · QR ${fmtTL(summary.qrRevenue)}`}
          />
          <Kpi label="Sipariş" value={fmtNum(summary.orderCount)} />
          <Kpi
            label="Bakiye yükleme"
            value={fmtTL(summary.topUpTotal)}
            hint={`${fmtNum(summary.newUsers)} yeni kullanıcı`}
          />
          <Kpi
            label="Dağıtılan damga"
            value={fmtNum(summary.stampsEarned)}
            hint={`${fmtNum(summary.freeDrinksGranted)} ikram tanımlandı`}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle>Son 30 gün · ciro</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="ciro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDayShort}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v: number) => fmtTL(v)}
                />
                <Tooltip
                  labelFormatter={(v) => fmtDayShort(String(v))}
                  formatter={(v) => [fmtTL(Number(v)), 'Ciro']}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  fill="url(#ciro)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle>Bugün · saatlik yoğunluk</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ left: -26, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: number) => `${h}`}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                  formatter={(v) => [fmtNum(Number(v)), 'Sipariş']}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="orders" fill="var(--color-gold-dark)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Şubeler · bugün</SectionTitle>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wide text-ink-muted uppercase">
                <th className="px-5 py-3 font-semibold">Şube</th>
                <th className="px-5 py-3 font-semibold">Durum</th>
                <th className="px-5 py-3 text-right font-semibold">Sipariş</th>
                <th className="px-5 py-3 text-right font-semibold">Ciro</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.branchId} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{b.name}</td>
                  <td className="px-5 py-3">
                    <Badge tone={b.isOpen ? 'ok' : 'bad'}>
                      {b.isOpen ? 'Açık' : 'Kapalı'}
                    </Badge>
                  </td>
                  <td className="tnum px-5 py-3 text-right">{fmtNum(b.orders)}</td>
                  <td className="tnum px-5 py-3 text-right font-semibold">
                    {fmtTL(b.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

/// Operasyonun anında görmesi gereken aksaklıklar. Hepsi temizse şerit hiç
/// çizilmez — "her şey yolunda" mesajı gürültü yapmasın.
function AlertStrip({ alerts }: { alerts: Alerts }) {
  const items: { tone: 'bad' | 'warn'; text: string }[] = [];
  if (alerts.unforwardedOrders > 0) {
    items.push({
      tone: 'bad',
      text: `${alerts.unforwardedOrders} sipariş şube POS'una iletilemedi`,
    });
  }
  if (alerts.failedPosEvents > 0) {
    items.push({ tone: 'bad', text: `${alerts.failedPosEvents} POS olayı başarısız` });
  }
  if (alerts.pendingPayments > 0) {
    items.push({
      tone: 'warn',
      text: `${alerts.pendingPayments} ödeme onay bekliyor`,
    });
  }
  if (alerts.closedBranches.length > 0) {
    items.push({
      tone: 'warn',
      text: `Kapalı şube: ${alerts.closedBranches.join(', ')}`,
    });
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Badge key={i.text} tone={i.tone}>
          {i.text}
        </Badge>
      ))}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--color-line)',
  fontSize: 12,
} as const;
