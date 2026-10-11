import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, Ban, Check, Clock3, Coffee, PackageCheck, ReceiptText, RefreshCw, Store, UserRound } from 'lucide-react';
import { ApiError, readApi } from '../../api/client';
import { addDateRange } from '../../api/filters';
import { fmtNum, fmtTL } from '../../api/format';
import type { OrderRow, Status } from '../../api/schemas';
import { orderCancelResultSchema, orderDetailSchema, orderListSchema, orderStatusResultSchema } from '../../api/schemas';
import { useAuth } from '../../auth/auth-state';
import { DownloadMenu } from '../../components/DownloadMenu';
import { Drawer, Input, ReasonDialog, Select, Tabs } from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { QueryError, Spinner, Badge, Button, Card, Kpi, SectionTitle, } from '../../components/ui';

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
const BOARD = ['RECEIVED', 'PREPARING', 'READY'] as const;
const BOARD_ICON = { RECEIVED: ReceiptText, PREPARING: Coffee, READY: PackageCheck };
const BOARD_HINT = { RECEIVED: 'Hazırlamaya başlayın', PREPARING: 'Mutfaktaki siparişler', READY: 'Teslim alınmayı bekliyor' };
const NEXT_LABEL: Partial<Record<Status, string>> = {
  PREPARING: 'Hazırlamaya başla', READY: 'Hazır olarak işaretle', COMPLETED: 'Teslim edildi',
};

/// Bir durumdan ileri gidilecek tek adım. Sunucu zaten doğruluyor;
/// buton yalnız anlamlı olanı gösterir.
const NEXT: Partial<Record<Status, Status>> = {
  RECEIVED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

export function OrdersPage() {
  const { admin } = useAuth();
  const canOperate = admin?.role !== 'VIEWER';
  const [tab, setTab] = useState('board');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const validDates = !from || !to || from <= to;
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [boardPage, setBoardPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['orders', 'list', { q, status, page, from, to }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      addDateRange(params, from, to);
      return readApi(orderListSchema, `/admin/orders?${params}`, { signal });
    },
    enabled: tab === 'list' && validDates,
  });
  const boardQuery = useQuery({
    queryKey: ['orders', 'board', boardPage],
    queryFn: ({ signal }) => readApi(orderListSchema, `/admin/orders?activeOnly=true&page=${boardPage}&pageSize=50`, { signal }),
    enabled: tab === 'board',
    refetchInterval: tab === 'board' ? 10_000 : false,
  });
  const shownQuery = tab === 'board' ? boardQuery : listQuery;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['order', openId] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const columns: Column<OrderRow>[] = [
    { key: 'id', header: 'Sipariş', render: (o) => <span className="tnum font-semibold tracking-tight">{o.id}</span> },
    { key: 'time', header: 'Saat', render: (o) => <time dateTime={o.createdAt} className="tnum whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(o.createdAt)}</time> },
    { key: 'branch', header: 'Şube', render: (o) => o.branchName },
    {
      key: 'customer',
      header: 'Müşteri',
      render: (o) => (
        <div className="space-y-1">
          <p className="font-medium">{o.customerName || '—'}</p>
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

  const orders = shownQuery.data?.orders ?? [];

  // Dışa aktarım ekrandaki filtreyi izler: kullanıcı ne görüyorsa onu indirir.
  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (status) exportParams.set('status', status);
  addDateRange(exportParams, from, to);
  const exportQuery = exportParams.toString() ? `?${exportParams}` : '';

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <div className="space-y-2">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-muted uppercase">Operasyon</p>
      <PageHeader
        title="Siparişler"
        subtitle="Siparişi al, hazırla, müşterinle buluştur."
        actions={
          tab === 'list' ? <DownloadMenu disabled={!validDates}
            items={[
              {
                label: 'Excel raporu (.xlsx)',
                hint: 'Seçili filtrelerdeki siparişler ve kalemler; en fazla 10.000 kayıt',
                path: `/admin/orders/export.xlsx${exportQuery}`,
                fallbackName: 'dosso-dossi-siparisler.xlsx',
              },
              {
                label: 'CSV (.csv)',
                hint: 'Seçili filtrelerdeki tüm siparişler; en fazla 10.000 kayıt',
                path: `/admin/orders/export.csv${exportQuery}`,
                fallbackName: 'dosso-dossi-siparisler.csv',
              },
            ]}
          /> : boardQuery.data ? (
            <span className="tnum inline-flex items-center gap-2 rounded-chip border border-line bg-surface px-3 py-2 text-xs font-medium text-ink">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
              {fmtNum(boardQuery.data.total)} aktif sipariş
            </span>
          ) : null
        }
      />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
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
        {tab === 'board' ? (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <RefreshCw aria-hidden="true" className={`size-3.5 ${boardQuery.isFetching ? 'motion-safe:animate-spin' : ''}`} strokeWidth={1.6} />
            <span>{boardQuery.dataUpdatedAt ? `Son yenileme ${fmtTime(new Date(boardQuery.dataUpdatedAt).toISOString())}` : 'Pano yükleniyor'}</span>
            <span className="hidden sm:inline">· 10 sn'de bir</span>
          </div>
        ) : null}
        {tab === 'list' ? (
          <div className="flex w-full flex-wrap items-center gap-3 pt-2">
            <Input
              aria-label="Sipariş, telefon veya isim ara"
              placeholder="DD-1042, telefon veya isim"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-64"
            />
            <Select
              aria-label="Sipariş durumu"
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
            <Input aria-label="Başlangıç tarihi" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <Input aria-label="Bitiş tarihi" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            <span className="text-xs text-ink-muted">Tarihler cihazınızın saat dilimindedir.</span>
          </div>
        ) : null}
      </div>

      {tab === 'list' && !validDates ? <p role="alert" className="text-sm text-bad">Bitiş tarihi başlangıçtan önce olamaz.</p> : null}
      {shownQuery.error ? <p role="alert" className="text-sm text-bad">Siparişler yüklenemedi. <button onClick={() => void shownQuery.refetch()}>Yeniden dene</button></p> : null}
      {tab === 'board' && boardQuery.isLoading ? <Spinner /> : null}
      {tab === 'board' && !boardQuery.isLoading && !boardQuery.error ? (
        <>
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {BOARD.map((col) => {
            const items = orders.filter((o) => o.status === col);
            const Icon = BOARD_ICON[col];
            return (
              <section key={col} aria-labelledby={`orders-${col}`} className="flex min-w-0 flex-col gap-3">
                <div className="mb-1 flex items-start justify-between gap-3 px-1">
                  <div>
                    <h2 id={`orders-${col}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Icon aria-hidden="true" className="size-4 text-ink-muted" strokeWidth={1.6} />
                      {STATUS_LABEL[col]}
                    </h2>
                    <p className="mt-1.5 text-xs text-ink-muted">{BOARD_HINT[col]}</p>
                  </div>
                  <span className="tnum inline-flex min-w-6 justify-center rounded-md border border-line bg-surface-sunken px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
                    {fmtNum(items.length)}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line px-5 py-8 text-center text-xs text-ink-muted">
                    <Icon aria-hidden="true" className="size-5 opacity-60" strokeWidth={1.4} />
                    <p>Bekleyen sipariş yok.</p>
                  </div>
                ) : (
                  items.map((o) => (
                    <Card key={o.id} className="min-w-0 transition-shadow hover:shadow-sm">
                      <button type="button" onClick={() => setOpenId(o.id)} aria-label={`${o.id} sipariş ayrıntılarını aç`} className="group block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-surface">
                        <div className="flex items-start justify-between gap-3">
                          <p className="tnum text-sm font-bold tracking-tight text-ink">{o.id}</p>
                          <time dateTime={o.createdAt} className="tnum inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                            <Clock3 aria-hidden="true" className="size-3" strokeWidth={1.7} /> {fmtTime(o.createdAt)}
                          </time>
                        </div>
                        <div className="mt-4 space-y-2 border-y border-line py-3.5 text-xs leading-relaxed text-ink-muted">
                          <p className="flex items-start gap-2"><Store aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.6} /><span>{o.branchName}</span></p>
                          <p className="flex items-start gap-2"><UserRound aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.6} /><span className="break-words text-ink">{o.customerName || o.customerPhone}</span></p>
                        </div>
                        <div className="mt-3.5 flex items-center justify-between gap-3">
                          <p className="tnum font-display text-lg font-bold tracking-tight text-ink">{fmtTL(o.total)}</p>
                          <span className="tnum inline-flex items-center gap-1.5 text-xs text-ink-muted">{fmtNum(o.itemCount)} kalem <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.7} /></span>
                        </div>
                        {o.usedFreeDrink || o.promoCode || !o.forwarded ? <div className="mt-3 flex flex-wrap gap-1.5">
                          {o.usedFreeDrink ? <Badge tone="gold">İkram</Badge> : null}
                          {o.promoCode ? <Badge>{o.promoCode}</Badge> : null}
                          {!o.forwarded ? <Badge tone="bad">POS'a iletilmedi</Badge> : null}
                        </div> : null}
                      </button>
                      {canOperate && NEXT[o.status] ? (
                        <StatusButton
                          id={o.id}
                          next={NEXT[o.status]!}
                          onDone={refresh}
                        />
                      ) : null}
                    </Card>
                  ))
                )}
              </section>
            );
          })}
        </div>
        <p className="tnum text-xs text-ink-muted">{fmtNum(boardQuery.data?.total ?? 0)} aktif sipariş · Sayfa {boardPage}. Durum adetleri bu sayfadaki siparişleri gösterir.</p>
        <Pager page={boardPage} pageSize={boardQuery.data?.pageSize ?? 50} total={boardQuery.data?.total} onPage={setBoardPage} />
        </>
      ) : tab === 'list' ? (
        <>
          <DataTable
            columns={columns}
            rows={orders}
            rowKey={(o) => o.id}
            onRowClick={(o) => setOpenId(o.id)}
            loading={listQuery.isLoading} error={listQuery.error} onRetry={() => void listQuery.refetch()}
            empty="Bu filtreyle sipariş yok"
          />
          <Pager
            page={listQuery.data?.page ?? 1}
            pageSize={listQuery.data?.pageSize ?? 25}
            total={listQuery.data?.total}
            onPage={setPage}
          />
        </>
      ) : null}

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
      readApi(orderStatusResultSchema, `/admin/orders/${id}/status`, { method: 'POST', body: { status: next } }),
    onSuccess: onDone,
  });
  return (
    <>
    <Button
      variant={next === 'PREPARING' ? 'primary' : 'outline'}
      className="mt-4 min-h-10 w-full"
      onClick={() => m.mutate()}
      disabled={m.isPending}
    >
      {m.isPending ? <RefreshCw aria-hidden="true" className="size-3.5 motion-safe:animate-spin" /> : next === 'COMPLETED' ? <Check aria-hidden="true" className="size-3.5" strokeWidth={1.7} /> : null}
      {m.isPending ? 'İşleniyor…' : NEXT_LABEL[next] ?? `${STATUS_LABEL[next]} yap`}
    </Button>
    {m.error ? <p role="alert" className="mt-2 text-xs text-bad">{m.error.message}</p> : null}
    </>
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
  const { admin } = useAuth();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState('');

  const detail = useQuery({
    queryKey: ['order', id],
    queryFn: ({ signal }) => readApi(orderDetailSchema, `/admin/orders/${id}`, { signal }),
    enabled: !!id,
  });

  const { data } = detail;

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      readApi(orderCancelResultSchema, `/admin/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setCancelOpen(false);
      onChanged();
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'İptal edilemedi'),
  });

  const canCancel =
    admin?.role !== 'VIEWER' && data && data.status !== 'CANCELLED' && data.status !== 'COMPLETED';

  return (
    <>
      <Drawer
        open={!!id}
        title={data?.id ?? 'Sipariş'}
        onClose={onClose}
        footer={
          canCancel ? (
            <button type="button" onClick={() => setCancelOpen(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-chip border border-bad/20 px-4 py-2.5 text-sm font-semibold text-bad transition hover:bg-bad-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bad">
              <Ban aria-hidden="true" className="size-4" strokeWidth={1.7} />
              Siparişi iptal et ve iade yap
            </button>
          ) : null
        }
      >
        {detail.isLoading ? <Spinner /> : null}
        <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
        {!data || detail.error ? null : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
              <time dateTime={data.createdAt} className="tnum inline-flex items-center gap-1.5 text-xs text-ink-muted"><Clock3 aria-hidden="true" className="size-3.5" strokeWidth={1.6} />{fmtDateTime(data.createdAt)}</time>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Tutar" value={fmtTL(data.total)} />
              <Kpi label="Kazanılan damga" value={fmtNum(data.stampsEarned)} />
            </div>

            <Card>
              <SectionTitle>Bilgiler</SectionTitle>
              <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
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
              <ul className="flex flex-col text-sm">
                {data.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-4 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0">
                    <span className="min-w-0 font-medium leading-relaxed">
                      <span className="tnum mr-1.5 text-ink-muted">{i.quantity}×</span> {i.productName}
                      {i.isFreeDrink ? <Badge tone="gold"> ikram</Badge> : null}
                      <span className="mt-1 block text-xs font-normal text-ink-muted">
                        {[i.size, i.milk, i.shot].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="tnum shrink-0 pt-0.5 font-semibold">
                      {fmtTL(i.unitPrice * i.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
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
              <ul className="flex flex-col gap-4 text-sm">
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
      <dd className="min-w-0 break-words text-ink">{children}</dd>
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
    <div className={`flex justify-between gap-4 ${strong ? 'border-t border-line pt-3 font-bold text-ink' : 'text-ink-muted'}`}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
