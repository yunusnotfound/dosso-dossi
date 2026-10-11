import { Clock3 } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDayShort, fmtNum, fmtTL } from '../../api/format';
import type { HourlyPoint, TimeseriesPoint } from '../../api/types';
import { Card, EmptyState } from '../../components/ui';

const tooltipStyle = {
  borderRadius: 12, border: '1px solid var(--color-line)', backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)', fontSize: 12, padding: '10px 14px',
};
const tickStyle = { fontSize: 11, fill: 'var(--color-ink-muted)' };
const compactMoney = (value: number) => `${new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ₺`;

export function RevenueChart({ data }: { data: TimeseriesPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.revenue, 0);
  return <Card className="h-full min-w-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold tracking-tight text-ink">Ciroya yakından bak</h2>
      <span className="rounded-chip bg-surface-sunken px-2.5 py-1.5 text-xs text-ink-muted">Son 30 gün</span>
    </div>
    <p className="tnum font-display text-3xl font-bold tracking-tight text-ink">{fmtTL(total)}</p>
    <p className="mt-1 text-xs text-ink-muted">Sipariş ve QR tahsilatları</p>
    {data.length === 0 ? <div className="mt-6"><EmptyState>Bu dönem için ciro kaydı bulunmuyor.</EmptyState></div> :
      <div className="mt-6 h-52 sm:h-56" role="group" aria-label="Son 30 günün günlük ciro grafiği">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }} accessibilityLayer>
            <defs><linearGradient id="dashboard-revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.01} />
            </linearGradient></defs>
            <CartesianGrid stroke="var(--color-line)" vertical={false} strokeDasharray="3 5" />
            <XAxis dataKey="date" tickFormatter={fmtDayShort} tick={tickStyle} tickLine={false} axisLine={false} minTickGap={28} dy={8} />
            <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={64} tickFormatter={compactMoney} />
            <Tooltip labelFormatter={(value) => fmtDayShort(String(value))} formatter={(value) => [fmtTL(Number(value)), 'Ciro']} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="revenue" stroke="var(--color-brand)" strokeWidth={2.5} fill="url(#dashboard-revenue-fill)" activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>}
  </Card>;
}

export function HourlyChart({ data }: { data: HourlyPoint[] }) {
  return <Card className="min-w-0">
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-ink">Kahvenin en yoğun saatleri</h2>
      <Clock3 size={17} aria-hidden="true" className="text-ink-muted" />
    </div>
    <p className="text-xs text-ink-muted">Bugünkü siparişlerin saatlere dağılımı</p>
    {data.length === 0 ? <div className="mt-5"><EmptyState>Bugün için saatlik sipariş kaydı bulunmuyor.</EmptyState></div> :
      <div className="mt-6 h-52" role="group" aria-label="Bugünkü siparişlerin saatlik yoğunluk grafiği">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }} accessibilityLayer>
            <CartesianGrid stroke="var(--color-line)" vertical={false} strokeDasharray="3 5" />
            <XAxis dataKey="hour" tickFormatter={(hour: number) => String(hour).padStart(2, '0')} tick={tickStyle} tickLine={false} axisLine={false} interval={3} dy={6} />
            <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} width={32} />
            <Tooltip labelFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`} formatter={(value) => [fmtNum(Number(value)), 'Sipariş']} contentStyle={tooltipStyle} />
            <Bar dataKey="orders" fill="var(--color-brand)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>}
  </Card>;
}
