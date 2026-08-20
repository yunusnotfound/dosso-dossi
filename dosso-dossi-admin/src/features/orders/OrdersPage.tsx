import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import { Drawer, Input, ReasonDialog, Select, Tabs } from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { Badge, Button, Card, Kpi, SectionTitle, fmtNum, fmtTL } from '../../components/ui';
import { DownloadMenu } from '../../components/DownloadMenu';

type Status = 'RECEIVED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

interface OrderRow {
  id: string;
  number: number;
  status: Status;
  branchName: string;
  customerName: string;
  customerPhone: string;
  itemCount: number;
  total: number;
  usedFreeDrink: boolean;
  promoCode: string | null;
  forwarded: boolean;
  createdAt: string;
}

interface OrderList {
  page: number;
  pageSize: number;
  total: number;
  orders: OrderRow[];
}

interface OrderDetail {
  id: string;
  status: Status;
  pickupSlot: string;
  branch: { id: string; name: string };
  customer: { id: string; name: string; phone: string };
  subtotal: number;
  discount: number;
  freeDrinkDiscount: number;
  total: number;
  promoCode: string | null;
  usedFreeDrink: boolean;
  stampsEarned: number;
  forwardedAt: string | null;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    size: string;
    milk: string;
    shot: string;
    isFreeDrink: boolean;
  }[];
  walletTransactions: {
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    note: string;
    createdAt: string;
  }[];
}

const STATUS_LABEL: Record<Status, string> = {
  RECEIVED: 'Alındı',
  PREPARING: 'Hazırlanıyor',
  READY: 'Hazır',
  COMPLETED: 'Teslim edildi',
  CANCELLED: 'İptal',
};

const STATUS_TONE: Record<Status, 'neutral' | 'warn' | 'ok' | 'bad' | 'gold'> = {
  RECEIVED: 'neutral',
  PREPARING: 'warn',
  READY: 'gold',
  COMPLETED: 'ok',
  CANCELLED: 'bad',
};

/// Panoda gösterilen akış. COMPLETED/CANCELLED listede kalır, panoda değil.
const BOARD: Status[] = ['RECEIVED', 'PREPARING', 'READY'];

/// Bir durumdan ileri gidilecek tek adım. Sunucu zaten doğruluyor;
/// buton yalnız anlamlı olanı gösterir.
const NEXT: Partial<Record<Status, Status>> = {
  RECEIVED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

export function OrdersPage() {
  const [tab, setTab] = useState('board');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['orders', { q, status, page, tab }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      return api<OrderList>(`/admin/orders?${params}`);
    },
    // Canlı pano: kısa aralıkla tazelenir.
    refetchInterval: tab === 'board' ? 10_000 : false,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['order', openId] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const columns: Column<OrderRow>[] = [
    { key: 'id', header: 'Sipariş', render: (o) => <span className="font-semibold">{o.id}</span> },
    { key: 'time', header: 'Saat', render: (o) => fmtDateTime(o.createdAt) },
    { key: 'branch', header: 'Şube', render: (o) => o.branchName },
    {
      key: 'customer',
      header: 'Müşteri',
      render: (o) => (
        <div>
          <p>{o.customerName || '—'}</p>
          <p className="tnum text-xs text-ink-muted">{o.customerPhone}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (o) => <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>,
    },
    {
      key: 'flags',
      header: 'Not',
      render: (o) => (
        <div className="flex gap-1">
          {o.usedFreeDrink ? <Badge tone="gold">ikram</Badge> : null}
          {o.promoCode ? <Badge>{o.promoCode}</Badge> : null}
          {!o.forwarded && o.status !== 'CANCELLED' ? (
            <Badge tone="bad">iletilmedi</Badge>
          ) : null}
        </div>
      ),
    },
    { key: 'items', header: 'Kalem', numeric: true, render: (o) => fmtNum(o.itemCount) },
    {
      key: 'total',
      header: 'Tutar',
      numeric: true,
      render: (o) => <span className="font-semibold">{fmtTL(o.total)}</span>,
    },
  ];

  const orders = listQuery.data?.orders ?? [];

  // Dışa aktarım ekrandaki filtreyi izler: kullanıcı ne görüyorsa onu indirir.
  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (status) exportParams.set('status', status);
  const exportQuery = exportParams.toString() ? `?${exportParams}` : '';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Siparişler"
        subtitle="Canlı pano ve geçmiş"
        actions={
          <DownloadMenu
            items={[
              {
                label: 'Excel raporu (.xlsx)',
                hint: 'Özet · Siparişler · Kalemler sayfaları, marka biçimli',
                path: `/admin/orders/export.xlsx${exportQuery}`,
                fallbackName: 'dosso-dossi-siparisler.xlsx',
              },
              {
                label: 'CSV (.csv)',
                hint: 'Ham veri — muhasebe yazılımına aktarım için',
                path: `/admin/orders/export.csv${exportQuery}`,
                fallbackName: 'dosso-dossi-siparisler.csv',
              },
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { id: 'board', label: 'Canlı pano' },
            { id: 'list', label: 'Tüm siparişler' },
          ]}
          active={tab}
          onChange={(id) => {
            setTab(id);
            setPage(1);
          }}
        />
        {tab === 'list' ? (
          <>
            <Input
              placeholder="DD-1042, telefon veya isim"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-64"
            />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tüm durumlar</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </>
        ) : null}
      </div>

      {tab === 'board' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {BOARD.map((col) => {
            const items = orders.filter((o) => o.status === col);
            return (
              <div key={col} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <SectionTitle>{STATUS_LABEL[col]}</SectionTitle>
                  <span className="tnum text-sm font-semibold text-ink-muted">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <Card className="text-center text-sm text-ink-muted">Boş</Card>
                ) : (
                  items.map((o) => (
                    <Card key={o.id} className="cursor-pointer" >
                      <div onClick={() => setOpenId(o.id)}>
                        <div className="flex items-start justify-between">
                          <p className="font-semibold text-ink">{o.id}</p>
                          <span className="tnum text-xs text-ink-muted">
                            {fmtTime(o.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-ink-muted">
                          {o.branchName} · {o.customerName || o.customerPhone}
                        </p>
                        <p className="tnum mt-1 font-semibold">{fmtTL(o.total)}</p>
                      </div>
                      {NEXT[o.status] ? (
                        <StatusButton
                          id={o.id}
                          next={NEXT[o.status]!}
                          onDone={refresh}
                        />
                      ) : null}
                    </Card>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={orders}
            rowKey={(o) => o.id}
            onRowClick={(o) => setOpenId(o.id)}
            loading={listQuery.isLoading}
            empty="Bu filtreyle sipariş yok"
          />
          <Pager
            page={listQuery.data?.page ?? 1}
            pageSize={listQuery.data?.pageSize ?? 25}
            total={listQuery.data?.total ?? 0}
            onPage={setPage}
          />
        </>
      )}

      <OrderDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
    </div>
  );
}

function StatusButton({
  id,
  next,
  onDone,
}: {
  id: string;
  next: Status;
  onDone: () => void;
}) {
  const m = useMutation({
    mutationFn: () =>
      api(`/admin/orders/${id}/status`, { method: 'POST', body: { status: next } }),
    onSuccess: onDone,
  });
  return (
    <Button
      className="mt-3 w-full"
      onClick={() => m.mutate()}
      disabled={m.isPending}
    >
      {m.isPending ? '…' : `${STATUS_LABEL[next]} yap`}
    </Button>
  );
}

function OrderDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState('');

  const { data } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<OrderDetail>(`/admin/orders/${id}`),
    enabled: !!id,
  });

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      api(`/admin/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setCancelOpen(false);
      onChanged();
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'İptal edilemedi'),
  });

  const canCancel =
    data && data.status !== 'CANCELLED' && data.status !== 'COMPLETED';

  return (
    <>
      <Drawer
        open={!!id}
        title={data?.id ?? 'Sipariş'}
        onClose={onClose}
        footer={
          canCancel ? (
            <Button variant="ghost" onClick={() => setCancelOpen(true)}>
              Siparişi iptal et ve iade yap
            </Button>
          ) : null
        }
      >
        {!data ? null : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Tutar" value={fmtTL(data.total)} />
              <Kpi label="Kazanılan damga" value={fmtNum(data.stampsEarned)} />
            </div>

            <Card>
              <SectionTitle>Bilgiler</SectionTitle>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <Info label="Durum">
                  <Badge tone={STATUS_TONE[data.status]}>
                    {STATUS_LABEL[data.status]}
                  </Badge>
                </Info>
                <Info label="Şube">{data.branch.name}</Info>
                <Info label="Müşteri">
                  {data.customer.name || '—'} · {data.customer.phone}
                </Info>
                <Info label="Teslim">{data.pickupSlot}</Info>
                <Info label="Oluşturma">{fmtDateTime(data.createdAt)}</Info>
                <Info label="POS'a iletim">
                  {data.forwardedAt ? (
                    fmtDateTime(data.forwardedAt)
                  ) : (
                    <Badge tone="bad">iletilmedi</Badge>
                  )}
                </Info>
              </dl>
            </Card>

            <Card>
              <SectionTitle>Kalemler</SectionTitle>
              <ul className="flex flex-col gap-2 text-sm">
                {data.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>
                      {i.quantity}× {i.productName}
                      {i.isFreeDrink ? <Badge tone="gold"> ikram</Badge> : null}
                      <span className="block text-xs text-ink-muted">
                        {[i.size, i.milk, i.shot].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="tnum font-semibold">
                      {fmtTL(i.unitPrice * i.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-line pt-3 text-sm">
                <Row label="Ara toplam" value={fmtTL(data.subtotal)} />
                {data.discount > 0 ? (
                  <Row label={`İndirim ${data.promoCode ?? ''}`} value={`−${fmtTL(data.discount)}`} />
                ) : null}
                {data.freeDrinkDiscount > 0 ? (
                  <Row label="İkram" value={`−${fmtTL(data.freeDrinkDiscount)}`} />
                ) : null}
                <Row label="Toplam" value={fmtTL(data.total)} strong />
              </div>
            </Card>

            <Card>
              <SectionTitle>Cüzdan hareketleri</SectionTitle>
              <ul className="flex flex-col gap-2 text-sm">
                {data.walletTransactions.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3">
                    <span>
                      {t.note}
                      <span className="block text-xs text-ink-muted">
                        {fmtDateTime(t.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`tnum font-semibold ${t.amount < 0 ? 'text-bad' : 'text-ok'}`}
                    >
                      {fmtTL(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Drawer>

      <ReasonDialog
        open={cancelOpen}
        title="Siparişi iptal et"
        description="Tutar müşterinin cüzdanına iade edilir, kazanılan damga ve kullanılan ikram geri alınır. İşlem geri alınamaz."
        confirmLabel="İptal et ve iade yap"
        busy={cancel.isPending}
        error={error}
        onConfirm={(reason) => cancel.mutate(reason)}
        onClose={() => setCancelOpen(false)}
      />
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? 'font-bold text-ink' : 'text-ink-muted'}`}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
