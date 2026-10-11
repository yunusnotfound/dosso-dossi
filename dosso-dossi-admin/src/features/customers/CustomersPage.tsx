import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useDebouncedValue } from '../../api/use-debounced-value';
import { ApiError, readApi } from '../../api/client';
import { fmtNum, fmtTL } from '../../api/format';
import type { CustomerRow } from '../../api/schemas';
import { balanceUpdateSchema, blockUpdateSchema, customerDetailSchema, customerListSchema, loyaltyUpdateSchema, revokedSessionsSchema } from '../../api/schemas';
import { DurableIntentError, withDurableIntent } from '../../api/mutation-intents';
import { useAuth } from '../../auth/auth-state';
import { Drawer, Field, Input, ReasonDialog, Select, Tabs } from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { QueryError, Spinner, Badge, Button, Card, Kpi, SectionTitle, } from '../../components/ui';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

export function CustomersPage() {
  const [q, setQ] = useState('');
  const search = useDebouncedValue(q.trim());
  const [sort, setSort] = useState<'recent' | 'ltv'>('recent');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['customers', { q: search, sort, page }],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams({ page: String(page), pageSize: '25', sort });
      if (search) p.set('q', search);
      return readApi(customerListSchema, `/admin/customers?${p}`, { signal });
    },
  });

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Müşteri',
      render: (c) => (
        <div>
          <p className="font-semibold text-ink">{c.name || '—'}</p>
          <p className="tnum text-xs text-ink-muted">{c.phone}</p>
        </div>
      ),
    },
    { key: 'balance', header: 'Bakiye', numeric: true, render: (c) => fmtTL(c.balance) },
    {
      key: 'loyalty',
      header: 'Damga',
      numeric: true,
      render: (c) => `${c.stamps}/${c.target}`,
    },
    { key: 'free', header: 'İkram', numeric: true, render: (c) => fmtNum(c.freeDrinks) },
    { key: 'orders', header: 'Sipariş', numeric: true, render: (c) => fmtNum(c.orderCount) },
    {
      key: 'ltv',
      header: 'Harcama',
      numeric: true,
      render: (c) => <span className="font-semibold">{fmtTL(c.lifetimeSpend)}</span>,
    },
    {
      key: 'status',
      header: 'Durum',
      render: (c) =>
        c.isBlocked ? <Badge tone="bad">Donduruldu</Badge> : <Badge tone="ok">Aktif</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Müşteriler" subtitle="Arama, 360° kart ve manuel düzeltmeler" />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Telefon veya isim"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Select value={sort} onChange={(e) => { setSort(e.target.value as 'recent' | 'ltv'); setPage(1); }}>
          <option value="recent">En yeni kayıt</option>
          <option value="ltv">En çok harcayan</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.customers}
        rowKey={(c) => c.id}
        onRowClick={(c) => setOpenId(c.id)}
        loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}
      />
      <Pager
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? 25}
        total={list.data?.total}
        onPage={setPage}
      />

      <CustomerDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

type Action = 'balance' | 'loyalty' | 'block' | 'unblock' | 'sessions' | null;

function CustomerDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { admin } = useAuth();
  const canEdit = admin?.role === 'SUPER_ADMIN' || admin?.role === 'MANAGER';
  const qc = useQueryClient();
  const [tab, setTab] = useState('wallet');
  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState(0);
  const [stamps, setStamps] = useState(0);
  const [freeDrinks, setFreeDrinks] = useState(0);
  const [error, setError] = useState('');

  const detail = useQuery({
    queryKey: ['customer', id],
    queryFn: ({ signal }) => readApi(customerDetailSchema, `/admin/customers/${id}`, { signal }),
    enabled: !!id,
  });

  const { data } = detail;

  const done = () => {
    setAction(null);
    setError('');
    void qc.invalidateQueries({ queryKey: ['customer', id] });
    void qc.invalidateQueries({ queryKey: ['customers'] });
  };

  const run = useMutation({
    mutationFn: async (reason: string) => {
      switch (action) {
        case 'balance': {
          const body = { amount: Number(amount), reason: reason.trim() };
          return withDurableIntent(`${admin!.id}:/admin/customers/${id}/balance`, body, (idempotencyKey) => readApi(balanceUpdateSchema, `/admin/customers/${id}/balance`, {
            method: 'POST', body: { ...body, idempotencyKey },
          }));
        }
        case 'loyalty':
          return readApi(loyaltyUpdateSchema, `/admin/customers/${id}/loyalty`, {
            method: 'POST',
            body: { stamps: Number(stamps), freeDrinks: Number(freeDrinks), reason },
          });
        case 'sessions':
          return readApi(revokedSessionsSchema, `/admin/customers/${id}/revoke-sessions`, {
            method: 'POST',
            body: { reason },
          });
        default:
          return readApi(blockUpdateSchema, `/admin/customers/${id}/block`, {
            method: 'POST',
            body: { isBlocked: action === 'block', reason },
          });
      }
    },
    onSuccess: done,
    onError: (e) => setError(e instanceof ApiError || e instanceof DurableIntentError ? e.message : 'İşlem başarısız'),
  });

  const openLoyalty = () => {
    setStamps(data?.loyalty.stamps ?? 0);
    setFreeDrinks(data?.loyalty.freeDrinks ?? 0);
    setAction('loyalty');
  };

  return (
    <>
      <Drawer
        open={!!id}
        title={data ? data.name || data.phone : 'Müşteri'}
        onClose={onClose}
      >
        {detail.isLoading ? <Spinner /> : null}
        <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
        {!data || detail.error ? null : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="Bakiye" value={fmtTL(data.balance)} />
              <Kpi
                label="Damga"
                value={`${data.loyalty.stamps}/${data.loyalty.target}`}
              />
              <Kpi label="İkram" value={fmtNum(data.loyalty.freeDrinks)} />
            </div>

            <Card>
              <SectionTitle>Hesap</SectionTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={data.isBlocked ? 'bad' : 'ok'}>
                  {data.isBlocked ? 'Donduruldu' : 'Aktif'}
                </Badge>
                <Badge>{fmtNum(data.activeSessions)} açık oturum</Badge>
                <Badge>{Number.isFinite(data.orderCount) ? fmtNum(data.orderCount) : '—'} sipariş</Badge>
                <span className="text-ink-muted">
                  Kayıt: {fmtDate(data.createdAt)}
                </span>
              </div>
              {canEdit ? <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setAction('balance')}>
                  Bakiye düzelt
                </Button>
                <Button variant="ghost" onClick={openLoyalty}>
                  Damga / ikram düzelt
                </Button>
                <Button variant="ghost" onClick={() => setAction('sessions')}>
                  Oturumları kapat
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAction(data.isBlocked ? 'unblock' : 'block')}
                >
                  {data.isBlocked ? 'Dondurmayı kaldır' : 'Hesabı dondur'}
                </Button>
              </div> : null}
            </Card>

            <Tabs
              tabs={[
                { id: 'wallet', label: 'Cüzdan' },
                { id: 'orders', label: 'Siparişler' },
                { id: 'loyalty', label: 'Sadakat' },
                { id: 'gifts', label: 'Hediyeler' },
              ]}
              active={tab}
              onChange={setTab}
            />

            {tab === 'wallet' ? (
              <Card>
                <ul className="flex flex-col gap-2 text-sm">
                  {data.transactions.map((t) => (
                    <li key={t.id} className="flex justify-between gap-3">
                      <span>
                        {t.note || t.type}
                        <span className="block text-xs text-ink-muted">
                          {fmtDate(t.createdAt)}
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
            ) : null}

            {tab === 'orders' ? (
              <Card>
                <ul className="flex flex-col gap-2 text-sm">
                  {data.orders.map((o) => (
                    <li key={o.id} className="flex justify-between gap-3">
                      <span>
                        {o.id} · {o.branchName}
                        <span className="block text-xs text-ink-muted">
                          {fmtDate(o.createdAt)} · {o.status}
                        </span>
                      </span>
                      <span className="tnum font-semibold">{fmtTL(o.total)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {tab === 'loyalty' ? (
              <Card>
                <ul className="flex flex-col gap-2 text-sm">
                  {data.loyaltyEvents.map((e) => (
                    <li key={e.id}>
                      {e.title}
                      <span className="block text-xs text-ink-muted">
                        {fmtDate(e.createdAt)} · {e.type}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {tab === 'gifts' ? (
              <Card>
                <SectionTitle>Gönderdiği</SectionTitle>
                <ul className="mb-4 flex flex-col gap-1 text-sm">
                  {data.giftsSent.map((g) => (
                    <li key={g.id}>
                      {g.label} → {g.recipientPhone} <Badge>{g.status}</Badge>
                    </li>
                  ))}
                </ul>
                <SectionTitle>Aldığı</SectionTitle>
                <ul className="flex flex-col gap-1 text-sm">
                  {data.giftsReceived.map((g) => (
                    <li key={g.id}>
                      {g.label} <Badge>{g.status}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        )}
      </Drawer>

      {/* Düzeltme değerleri gerekçe diyaloğundan önce alınır */}
      <Drawer
        open={action === 'balance'}
        title="Bakiye düzeltmesi"
        onClose={() => { if (!run.isPending) setAction(null); }}
      >
        <Field
          label="Tutar (₺)"
          hint="Artı ekler, eksi düşer. Bakiye eksiye düşürülemez."
        >
          <Input
            type="number"
            disabled={run.isPending}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
        <div className="mt-4">
          <ReasonInline
            busy={run.isPending}
            error={error}
            confirmLabel="Bakiyeyi güncelle"
            onConfirm={(r) => run.mutate(r)}
          />
        </div>
      </Drawer>

      <Drawer
        open={action === 'loyalty'}
        title="Damga / ikram düzeltmesi"
        onClose={() => { if (!run.isPending) setAction(null); }}
      >
        <div className="flex flex-col gap-4">
          <Field label="Damga" hint={`0 – ${(data?.loyalty.target ?? 5) - 1} arası`}>
            <Input
              type="number"
              value={stamps}
              onChange={(e) => setStamps(Number(e.target.value))}
            />
          </Field>
          <Field label="İkram hakkı">
            <Input
              type="number"
              value={freeDrinks}
              onChange={(e) => setFreeDrinks(Number(e.target.value))}
            />
          </Field>
          <ReasonInline
            busy={run.isPending}
            error={error}
            confirmLabel="Sadakati güncelle"
            onConfirm={(r) => run.mutate(r)}
          />
        </div>
      </Drawer>

      <ReasonDialog
        open={action === 'block' || action === 'unblock' || action === 'sessions'}
        title={
          action === 'sessions'
            ? 'Tüm oturumları kapat'
            : action === 'block'
              ? 'Hesabı dondur'
              : 'Dondurmayı kaldır'
        }
        description={
          action === 'sessions'
            ? 'Müşterinin tüm cihazlarındaki oturumlar düşer, yeniden giriş yapması gerekir.'
            : action === 'block'
              ? 'Hesap dondurulur ve açık oturumları kapatılır.'
              : 'Hesap yeniden kullanılabilir hâle gelir.'
        }
        busy={run.isPending}
        error={error}
        onConfirm={(r) => run.mutate(r)}
        onClose={() => { if (!run.isPending) setAction(null); }}
      />
    </>
  );
}

/// Çekmece içinde kullanılan gerekçe alanı (ayrı modal açmadan).
function ReasonInline({
  busy,
  error,
  confirmLabel,
  onConfirm,
}: {
  busy: boolean;
  error: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <Field label="Gerekçe" hint="En az 5 karakter — kayda geçer.">
        <Input disabled={busy} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error ? (
        <p className="rounded-chip bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
      <Button
        onClick={() => onConfirm(reason)}
        disabled={reason.trim().length < 5 || busy}
      >
        {busy ? 'İşleniyor…' : confirmLabel}
      </Button>
    </div>
  );
}
