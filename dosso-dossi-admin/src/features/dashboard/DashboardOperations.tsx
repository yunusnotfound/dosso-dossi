import { Activity, ArrowRight, Clock3, Radio, Send, Store, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtNum } from '../../api/format';
import type { Alerts } from '../../api/types';
import { Card } from '../../components/ui';

interface OperationRow {
  label: string; description: string; count: number; icon: LucideIcon; to: string | null; urgent?: boolean;
}

export function DashboardOperations({ alerts, central }: { alerts: Alerts; central: boolean }) {
  const rows: OperationRow[] = [
    { label: 'İletim bekleyen sipariş', description: alerts.unforwardedOrders > 0 ? 'Şubeye iletilmesi bekleniyor' : 'İletim bekleyen sipariş yok', count: alerts.unforwardedOrders, icon: Send, to: '/siparisler', urgent: true },
    { label: 'Onay bekleyen ödeme', description: alerts.pendingPayments > 0 ? 'Ödeme sonucu bekleniyor' : 'Onay bekleyen ödeme yok', count: alerts.pendingPayments, icon: Clock3, to: central ? '/finans' : null },
    { label: 'Başarısız POS olayı', description: alerts.failedPosEvents > 0 ? 'İşlem kaydını kontrol edin' : 'Başarısız olay bulunmuyor', count: alerts.failedPosEvents, icon: Radio, to: central ? '/pos' : null, urgent: true },
    { label: 'Kapalı şube', description: alerts.closedBranches.length ? alerts.closedBranches.join(', ') : 'Kapalı şube bulunmuyor', count: alerts.closedBranches.length, icon: Store, to: '/subeler' },
  ];
  return <Card className="flex h-full flex-col">
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-ink">Şimdi neler oluyor?</h2>
      <Activity size={18} aria-hidden="true" className="text-ink-muted" />
    </div>
    <div className="flex-1 divide-y divide-line">
      {rows.filter((row) => row.to !== null).map(({ label, description, count, icon: Icon, to, urgent }) => {
        const content = <>
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-chip ${count > 0 ? urgent ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn' : 'bg-surface-sunken text-ink-muted'}`}><Icon size={17} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{label}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted" title={description}>{description}</p>
          </div>
          <span className={`tnum font-display text-2xl font-semibold ${count > 0 && urgent ? 'text-bad' : 'text-ink'}`}>{fmtNum(count)}</span>
        </>;
        const className = 'flex items-center gap-3 py-4';
        return to ? <Link key={label} to={to} className={`${className} rounded-chip transition hover:bg-surface-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`} aria-label={`${label}: ${count}. İlgili sayfayı aç`}>{content}</Link>
          : <div key={label} className={className}>{content}</div>;
      })}
    </div>
    <div className="mt-3 border-t border-line pt-4">
      <Link to="/siparisler" className="inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        Sipariş panosunu aç <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  </Card>;
}
