import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import { ReasonDialog, Select, Tabs } from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { Badge, fmtNum, fmtTL } from '../../components/ui';
import { DownloadMenu } from '../../components/DownloadMenu';

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
}

interface Ledger {
  page: number;
  pageSize: number;
  total: number;
  totalsByType: { type: string; count: number; amount: number }[];
  entries: LedgerEntry[];
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  provider: string;
  providerRef: string | null;
  bonusDrinks: number;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  confirmedAt: string | null;
}

interface Charge {
  id: string;
  amount: number;
  status: string;
  saleRef: string | null;
  customerName: string;
  customerPhone: string;
  createdAt: string;
}

interface ReconRow {
  date: string;
  ourCount: number;
  ourAmount: number;
  posMatched: number;
  missingSaleRef: number;
}

const TX_LABEL: Record<string, string> = {
  TOPUP: 'Yükleme',
  ORDER_PAYMENT: 'Sipariş ödemesi',
  GIFT_SENT: 'Hediye gönderimi',
  GIFT_RECEIVED: 'Hediye alımı',
  QR_PAYMENT: 'QR ödemesi',
  REFUND: 'İade',
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

export function FinancePage() {
  const [tab, setTab] = useState('ledger');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finans"
        subtitle="Cüzdan defteri, yüklemeler, QR tahsilatları ve mutabakat"
        actions={
          <DownloadMenu
            items={[
              {
                label: 'Excel defteri (.xlsx)',
                hint: 'Özet + işlem tipi başına ayrı sayfa, marka biçimli',
                path: '/admin/finance/ledger.xlsx',
                fallbackName: 'dosso-dossi-cuzdan-defteri.xlsx',
              },
              {
                label: 'CSV (.csv)',
                hint: 'Ham veri — muhasebe yazılımına aktarım için',
                path: '/admin/finance/ledger.csv',
                fallbackName: 'dosso-dossi-cuzdan-defteri.csv',
              },
            ]}
          />
        }
      />
      <Tabs
        tabs={[
          { id: 'ledger', label: 'Cüzdan defteri' },
          { id: 'payments', label: 'Yüklemeler' },
          { id: 'charges', label: 'QR tahsilatları' },
          { id: 'recon', label: 'Mutabakat' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'ledger' ? <LedgerTab /> : null}
      {tab === 'payments' ? <PaymentsTab /> : null}
      {tab === 'charges' ? <ChargesTab /> : null}
      {tab === 'recon' ? <ReconTab /> : null}
    </div>
  );
}

function LedgerTab() {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ['ledger', { type, page }],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (type) p.set('type', type);
      return api<Ledger>(`/admin/finance/ledger?${p}`);
    },
  });

  const columns: Column<LedgerEntry>[] = [
    { key: 'date', header: 'Tarih', render: (e) => fmtDate(e.createdAt) },
    { key: 'type', header: 'Tip', render: (e) => <Badge>{TX_LABEL[e.type] ?? e.type}</Badge> },
    {
      key: 'customer',
      header: 'Müşteri',
      render: (e) => (
        <div>
          <p>{e.customerName || '—'}</p>
          <p className="tnum text-xs text-ink-muted">{e.customerPhone}</p>
        </div>
      ),
    },
    { key: 'note', header: 'Açıklama', render: (e) => e.note },
    {
      key: 'amount',
      header: 'Tutar',
      numeric: true,
      render: (e) => (
        <span className={`font-semibold ${e.amount < 0 ? 'text-bad' : 'text-ok'}`}>
          {fmtTL(e.amount)}
        </span>
      ),
    },
    {
      key: 'after',
      header: 'Sonraki bakiye',
      numeric: true,
      render: (e) => fmtTL(e.balanceAfter),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tüm tipler</option>
          {Object.entries(TX_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-2">
          {q.data?.totalsByType.map((t) => (
            <Badge key={t.type}>
              {TX_LABEL[t.type] ?? t.type}: {fmtTL(t.amount)} ({fmtNum(t.count)})
            </Badge>
          ))}
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={q.data?.entries}
        rowKey={(e) => e.id}
        loading={q.isLoading}
      />
      <Pager
        page={q.data?.page ?? 1}
        pageSize={q.data?.pageSize ?? 50}
        total={q.data?.total ?? 0}
        onPage={setPage}
      />
    </>
  );
}

function PaymentsTab() {
  const q = useQuery({
    queryKey: ['payments'],
    queryFn: () => api<Payment[]>('/admin/finance/payments'),
  });

  const tone = (s: string) =>
    s === 'SUCCEEDED' ? 'ok' : s === 'FAILED' ? 'bad' : s === 'PENDING' ? 'warn' : 'neutral';

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Tarih', render: (p) => fmtDate(p.createdAt) },
    {
      key: 'customer',
      header: 'Müşteri',
      render: (p) => (
        <div>
          <p>{p.customerName || '—'}</p>
          <p className="tnum text-xs text-ink-muted">{p.customerPhone}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Tutar', numeric: true, render: (p) => fmtTL(p.amount) },
    {
      key: 'bonus',
      header: 'İkram',
      numeric: true,
      render: (p) => (p.bonusDrinks > 0 ? <Badge tone="gold">+{p.bonusDrinks}</Badge> : '—'),
    },
    { key: 'provider', header: 'Sağlayıcı', render: (p) => p.provider },
    { key: 'ref', header: 'Referans', render: (p) => p.providerRef ?? '—' },
    {
      key: 'status',
      header: 'Durum',
      render: (p) => <Badge tone={tone(p.status)}>{p.status}</Badge>,
    },
  ];

  return (
    <DataTable columns={columns} rows={q.data} rowKey={(p) => p.id} loading={q.isLoading} />
  );
}

function ChargesTab() {
  const qc = useQueryClient();
  const [voidId, setVoidId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const q = useQuery({
    queryKey: ['charges'],
    queryFn: () => api<Charge[]>('/admin/finance/charges'),
  });

  const doVoid = useMutation({
    mutationFn: (reason: string) =>
      api(`/admin/finance/charges/${voidId}/void`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setVoidId(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['charges'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'İptal edilemedi'),
  });

  const columns: Column<Charge>[] = [
    { key: 'date', header: 'Tarih', render: (c) => fmtDate(c.createdAt) },
    {
      key: 'customer',
      header: 'Müşteri',
      render: (c) => (
        <div>
          <p>{c.customerName || '—'}</p>
          <p className="tnum text-xs text-ink-muted">{c.customerPhone}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Tutar', numeric: true, render: (c) => fmtTL(c.amount) },
    {
      key: 'ref',
      header: 'POS referansı',
      render: (c) =>
        c.saleRef ? c.saleRef : <Badge tone="bad">eşleşmedi</Badge>,
    },
    {
      key: 'status',
      header: 'Durum',
      render: (c) => (
        <Badge tone={c.status === 'APPROVED' ? 'ok' : 'neutral'}>{c.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c) =>
        c.status === 'APPROVED' ? (
          <button
            onClick={() => setVoidId(c.id)}
            className="text-xs font-semibold text-bad hover:underline"
          >
            İptal et
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <p className="text-sm text-ink-muted">
        İptal penceresi 15 dakikadır; süresi geçmiş tahsilat sunucu tarafından
        reddedilir.
      </p>
      <DataTable columns={columns} rows={q.data} rowKey={(c) => c.id} loading={q.isLoading} />
      <ReasonDialog
        open={!!voidId}
        title="Tahsilatı iptal et"
        description="Tutar müşterinin cüzdanına iade edilir."
        confirmLabel="İptal et ve iade yap"
        busy={doVoid.isPending}
        error={error}
        onConfirm={(r) => doVoid.mutate(r)}
        onClose={() => setVoidId(null)}
      />
    </>
  );
}

function ReconTab() {
  const [days, setDays] = useState(7);
  const q = useQuery({
    queryKey: ['recon', days],
    queryFn: () => api<ReconRow[]>(`/admin/finance/reconciliation?days=${days}`),
  });

  const columns: Column<ReconRow>[] = [
    { key: 'date', header: 'Gün', render: (r) => r.date },
    { key: 'count', header: 'Bizim kayıt', numeric: true, render: (r) => fmtNum(r.ourCount) },
    { key: 'amount', header: 'Tutar', numeric: true, render: (r) => fmtTL(r.ourAmount) },
    {
      key: 'matched',
      header: 'POS eşleşen',
      numeric: true,
      render: (r) => fmtNum(r.posMatched),
    },
    {
      key: 'missing',
      header: 'Eşleşmeyen',
      numeric: true,
      render: (r) =>
        r.missingSaleRef > 0 ? (
          <Badge tone="bad">{fmtNum(r.missingSaleRef)}</Badge>
        ) : (
          <span className="text-ink-muted">0</span>
        ),
    },
  ];

  return (
    <>
      <div className="flex items-center gap-3">
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Son 7 gün</option>
          <option value={14}>Son 14 gün</option>
          <option value={30}>Son 30 gün</option>
        </Select>
        <p className="text-sm text-ink-muted">
          Eşleşmeyen satırlar, POS tarafında karşılığı bulunamayan QR tahsilatlarıdır.
        </p>
      </div>
      <DataTable columns={columns} rows={q.data} rowKey={(r) => r.date} loading={q.isLoading} />
    </>
  );
}
