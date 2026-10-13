import { useQuery } from '@tanstack/react-query';
import { Bean, CircleDollarSign, ReceiptText, Store, Wallet } from 'lucide-react';
import { readApi } from '../../api/client';
import { fmtNum, fmtTL } from '../../api/format';
import { dashboardResponseSchema } from '../../api/schemas';
import { useAuth } from '../../auth/auth-state';
import { Button, EmptyState, Kpi, Spinner } from '../../components/ui';
import { BranchPerformance } from './BranchPerformance';
import { HourlyChart, RevenueChart } from './DashboardCharts';
import { DashboardOperations } from './DashboardOperations';

export function DashboardPage() {
  const { admin } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => readApi(dashboardResponseSchema, '/admin/dashboard?days=30', { signal }),
    refetchInterval: 60_000,
  });
  if (isLoading) return <Spinner />;
  if (error || !data) {
    return <EmptyState><div className="flex flex-col items-center gap-4">
      <p>Panel verisi yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.</p>
      <Button variant="ghost" disabled={isFetching} onClick={() => void refetch()}>Tekrar dene</Button>
    </div></EmptyState>;
  }
  const { summary, timeseries, branches, hourly, alerts } = data;
  const central = admin?.role !== 'BRANCH_MANAGER';
  const scope = central ? 'Tüm şubeler' : branches[0]?.name ?? 'Şubeniz';
  return <div className="flex flex-col gap-6 lg:gap-7">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.13em] text-ink-muted uppercase">
          {new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'full' }).format(new Date())}
        </p>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight text-ink sm:text-4xl">Günün özeti.</h1>
        <p className="mt-2 text-sm text-ink-muted">Şubelerin, siparişlerin ve kahvenin ritmi.</p>
      </div>
      <span className="inline-flex max-w-full items-center gap-2 rounded-chip border border-line bg-surface px-3 py-2.5 text-sm text-ink-muted">
        <Store size={16} aria-hidden="true" className="shrink-0" /><span className="truncate">{scope}</span>
      </span>
    </header>
    <section aria-label="Bugünün performansı" className={`grid gap-3 min-[480px]:grid-cols-2 ${central ? 'xl:grid-cols-[1.2fr_1fr_1fr_1fr]' : 'xl:grid-cols-3'}`}>
      <Kpi emphasis label="Bugünkü uygulama cirosu" value={fmtTL(summary.totalRevenue)} icon={<CircleDollarSign size={18} aria-hidden="true" />} hint={`Uygulama siparişi ${fmtTL(summary.orderRevenue)} · Kayıtlı QR ${fmtTL(summary.qrRevenue)}`} />
      <Kpi label="Sipariş" value={fmtNum(summary.orderCount)} icon={<ReceiptText size={18} aria-hidden="true" />} hint="Bugün verilen siparişler" />
      {central ? <Kpi label="Bakiye yükleme" value={fmtTL(summary.topUpTotal)} icon={<Wallet size={18} aria-hidden="true" />} hint={`${fmtNum(summary.newUsers)} yeni kullanıcı`} /> : null}
      <Kpi label="Sipariş damgaları" value={fmtNum(summary.stampsEarned)} icon={<Bean size={18} aria-hidden="true" />} hint={central ? `Uygulama siparişlerinden · Toplam ${fmtNum(summary.freeDrinksGranted)} ikram tanımlandı` : 'Şubenizdeki uygulama siparişlerinden kazanıldı'} />
    </section>
    <section aria-label="Ciro ve operasyon" className="grid items-stretch gap-5 xl:grid-cols-5">
      <div className="min-w-0 xl:col-span-3"><RevenueChart data={timeseries} /></div>
      <div className="min-w-0 xl:col-span-2"><DashboardOperations alerts={alerts} central={central} /></div>
    </section>
    <section aria-label="Şube performansı ve saatlik yoğunluk" className="grid items-start gap-5 xl:grid-cols-5">
      <div className="min-w-0 xl:col-span-3"><BranchPerformance branches={branches} /></div>
      <div className="min-w-0 xl:col-span-2"><HourlyChart data={hourly} /></div>
    </section>
  </div>;
}
