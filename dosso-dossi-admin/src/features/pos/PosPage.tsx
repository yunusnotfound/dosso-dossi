import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import { ReasonDialog, Select, Tabs } from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { Badge, Button, Card, EmptyState, SectionTitle, fmtNum } from '../../components/ui';

interface PosEvent {
  id: string;
  source: string;
  eventType: string;
  externalId: string;
  status: 'RECEIVED' | 'PROCESSED' | 'FAILED';
  error: string | null;
  payload: unknown;
  response: unknown;
  createdAt: string;
  processedAt: string | null;
}

interface EventList {
  page: number;
  pageSize: number;
  total: number;
  events: PosEvent[];
}

interface Health {
  sources: { source: string; lastSeenAt: string | null; total: number; failed: number }[];
  outbox: {
    id: string;
    number: number;
    branchName: string;
    createdAt: string;
    waitingMinutes: number;
  }[];
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );

export function PosPage() {
  const [tab, setTab] = useState('health');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="POS İzleme" subtitle="Webhook sağlığı, olay defteri ve iletilemeyen siparişler" />
      <Tabs
        tabs={[
          { id: 'health', label: 'Sağlık' },
          { id: 'events', label: 'Olay defteri' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'health' ? <HealthTab /> : <EventsTab />}
    </div>
  );
}

function HealthTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['pos-health'],
    queryFn: () => api<Health>('/admin/pos/health'),
    refetchInterval: 30_000,
  });

  const retry = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/orders/${id}/retry-forward`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pos-health'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Kaynaklar</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          {q.data?.sources.length ? (
            q.data.sources.map((s) => (
              <Card key={s.source}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{s.source}</p>
                  <Badge tone={s.failed > 0 ? 'bad' : 'ok'}>
                    {s.failed > 0 ? `${fmtNum(s.failed)} hata` : 'sağlıklı'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-ink-muted">
                  Son olay: {s.lastSeenAt ? fmtDate(s.lastSeenAt) : '—'}
                </p>
                <p className="tnum text-sm text-ink-muted">
                  Toplam {fmtNum(s.total)} olay
                </p>
              </Card>
            ))
          ) : (
            <EmptyState>Henüz POS olayı yok</EmptyState>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>İletilemeyen siparişler (outbox)</SectionTitle>
        {q.data?.outbox.length === 0 ? (
          <EmptyState>Bekleyen sipariş yok — tüm siparişler POS'a iletildi.</EmptyState>
        ) : (
          <Card className="p-0">
            <ul>
              {q.data?.outbox.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0"
                >
                  <div>
                    <p className="font-semibold text-ink">{o.id}</p>
                    <p className="text-xs text-ink-muted">
                      {o.branchName} · {fmtDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={o.waitingMinutes > 5 ? 'bad' : 'warn'}>
                      {fmtNum(o.waitingMinutes)} dk bekliyor
                    </Badge>
                    <Button
                      variant="ghost"
                      onClick={() => retry.mutate(o.id)}
                      disabled={retry.isPending}
                    >
                      Yeniden ilet
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function EventsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<PosEvent | null>(null);
  const [requeueId, setRequeueId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const q = useQuery({
    queryKey: ['pos-events', { status, source, page }],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (status) p.set('status', status);
      if (source) p.set('source', source);
      return api<EventList>(`/admin/pos/events?${p}`);
    },
  });

  const requeue = useMutation({
    mutationFn: (reason: string) =>
      api(`/admin/pos/events/${requeueId}/requeue`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      setRequeueId(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['pos-events'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'İşlenemedi'),
  });

  const columns: Column<PosEvent>[] = [
    { key: 'date', header: 'Tarih', render: (e) => fmtDate(e.createdAt) },
    { key: 'source', header: 'Kaynak', render: (e) => <Badge>{e.source}</Badge> },
    { key: 'type', header: 'Olay', render: (e) => e.eventType },
    { key: 'ext', header: 'Dış kimlik', render: (e) => e.externalId },
    {
      key: 'status',
      header: 'Durum',
      render: (e) => (
        <Badge
          tone={e.status === 'FAILED' ? 'bad' : e.status === 'PROCESSED' ? 'ok' : 'warn'}
        >
          {e.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (e) =>
        e.status === 'FAILED' ? (
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setRequeueId(e.id);
            }}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Yeniden kuyruğa al
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Tüm kaynaklar</option>
          <option value="kerzz">kerzz</option>
          <option value="payment">payment</option>
          <option value="simulator">simulator</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tüm durumlar</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="PROCESSED">PROCESSED</option>
          <option value="FAILED">FAILED</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={q.data?.events}
        rowKey={(e) => e.id}
        onRowClick={setDetail}
        loading={q.isLoading}
      />
      <Pager
        page={q.data?.page ?? 1}
        pageSize={q.data?.pageSize ?? 50}
        total={q.data?.total ?? 0}
        onPage={setPage}
      />

      {detail ? (
        <Card>
          <div className="flex items-center justify-between">
            <SectionTitle>Olay içeriği · {detail.externalId}</SectionTitle>
            <button
              onClick={() => setDetail(null)}
              className="text-sm text-ink-muted hover:underline"
            >
              Kapat
            </button>
          </div>
          {detail.error ? (
            <p className="mb-3 rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">
              {detail.error}
            </p>
          ) : null}
          <pre className="overflow-x-auto rounded-[--radius-chip] bg-surface-sunken p-3 text-xs">
            {JSON.stringify({ payload: detail.payload, response: detail.response }, null, 2)}
          </pre>
        </Card>
      ) : null}

      <ReasonDialog
        open={!!requeueId}
        title="Olayı yeniden kuyruğa al"
        description="Olay RECEIVED durumuna döner ve yeniden işlenebilir. İşlem idempotent olduğu için çifte etki oluşmaz."
        confirmLabel="Yeniden kuyruğa al"
        busy={requeue.isPending}
        error={error}
        onConfirm={(r) => requeue.mutate(r)}
        onClose={() => setRequeueId(null)}
      />
    </>
  );
}
