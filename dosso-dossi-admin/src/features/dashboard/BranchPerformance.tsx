import { ArrowRight, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtNum, fmtTL } from '../../api/format';
import type { BranchStat } from '../../api/types';
import { Badge, Card, EmptyState } from '../../components/ui';

export function BranchPerformance({ branches }: { branches: BranchStat[] }) {
  return <Card className="overflow-hidden">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold tracking-tight text-ink">Şubelerden bugün</h2><p className="mt-1 text-xs text-ink-muted">Günlük performans ve çalışma durumu</p></div>
      <Link to="/subeler" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">Şubeler <ArrowRight size={14} aria-hidden="true" /></Link>
    </div>
    {branches.length === 0 ? <EmptyState>Gösterilecek şube bulunmuyor.</EmptyState> : <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-ink-muted">
          <th scope="col" className="pb-3 pr-4 font-medium">Şube</th>
          <th scope="col" className="pb-3 pr-4 font-medium">Durum</th>
          <th scope="col" className="pb-3 pr-4 text-right font-medium">Sipariş</th>
          <th scope="col" className="pb-3 text-right font-medium">Ciro</th>
        </tr></thead>
        <tbody>{branches.map((branch) => <tr key={branch.branchId} className="border-b border-line last:border-0">
          <th scope="row" className="py-4 pr-4 text-left font-medium text-ink"><span className="flex items-center gap-2.5"><span className="hidden size-8 shrink-0 items-center justify-center rounded-chip bg-surface-sunken text-ink-muted sm:flex"><Store size={15} aria-hidden="true" /></span>{branch.name}</span></th>
          <td className="py-4 pr-4"><Badge tone={branch.isOpen ? 'ok' : 'neutral'}>{branch.isOpen ? 'Açık' : 'Kapalı'}</Badge></td>
          <td className="tnum py-4 pr-4 text-right text-ink-muted">{fmtNum(branch.orders)}</td>
          <td className="tnum py-4 text-right font-semibold text-ink">{fmtTL(branch.revenue)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </Card>;
}
