import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { readApi } from '../../api/client';
import { fmtDateTime, fmtTL } from '../../api/format';
import { accountRequestListSchema, accountRequestStatusSchema, accountRequestUpdateSchema, type AccountRequest, type AccountRequestStatus } from '../../api/schemas';
import { useAuth } from '../../auth/auth-state';
import { Drawer, ReasonDialog, Select } from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { Badge, Button } from '../../components/ui';

const STATUS: Record<AccountRequestStatus, string> = {
  OPEN: 'Yeni', IN_REVIEW: 'İnceleniyor', COMPLETED: 'Tamamlandı', REJECTED: 'Reddedildi', CANCELLED: 'Vazgeçildi',
};
const KIND: Record<AccountRequest['kind'], string> = { CLOSURE: 'Hesap kapatma', DATA_EXPORT: 'Veri erişimi' };
type Decision = 'IN_REVIEW' | 'COMPLETED' | 'REJECTED';

export function AccountRequestsPage() {
  const [status, setStatus] = useState<AccountRequestStatus>('OPEN');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AccountRequest | null>(null);
  const list = useQuery({
    queryKey: ['account-requests', status, page],
    queryFn: ({ signal }) => readApi(accountRequestListSchema, `/admin/account-requests?status=${status}&page=${page}`, { signal }),
    refetchInterval: 30_000,
  });
  const columns: Column<AccountRequest>[] = [
    { key: 'customer', header: 'Müşteri', render: (r) => <div><p className="font-semibold">{r.user.name || 'İsimsiz müşteri'}</p><p className="text-xs text-ink-muted">{r.user.phone}</p></div> },
    { key: 'kind', header: 'Talep', render: (r) => KIND[r.kind] },
    { key: 'status', header: 'Durum', render: (r) => <Badge>{STATUS[r.status]}</Badge> },
    { key: 'balance', header: 'Bakiye', numeric: true, render: (r) => fmtTL(r.balance) },
    { key: 'date', header: 'Oluşturulma', render: (r) => fmtDateTime(r.createdAt) },
  ];
  return <div className="flex flex-col gap-6">
    <PageHeader title="Hesap Talepleri" subtitle="Hesap kapatma ve kişisel verilere erişim talepleri" />
    <Select aria-label="Talep durumu" className="w-52" value={status} onChange={(e) => {
      const parsed = accountRequestStatusSchema.safeParse(e.target.value);
      if (parsed.success) { setStatus(parsed.data); setPage(1); }
    }}>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
    <DataTable columns={columns} rows={list.data?.entries} rowKey={(r) => r.id} onRowClick={setSelected} loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} />
    <Pager page={list.data?.page ?? page} pageSize={list.data?.pageSize ?? 30} total={list.data?.total} onPage={setPage} />
    {selected ? <RequestDrawer key={selected.id} request={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function RequestDrawer({ request, onClose }: { request: AccountRequest; onClose: () => void }) {
  const { admin } = useAuth();
  const canEdit = admin?.role === 'SUPER_ADMIN' || admin?.role === 'MANAGER';
  const terminal = !['OPEN', 'IN_REVIEW'].includes(request.status);
  const [decision, setDecision] = useState<Decision | null>(null);
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (response: string) => {
      if (!decision) throw new Error('Talep için bir işlem seçin.');
      return readApi(accountRequestUpdateSchema, `/admin/account-requests/${encodeURIComponent(request.id)}`, { method: 'PATCH', body: { status: decision, response } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDecision(null);
      onClose();
    },
  });
  const close = () => { if (!update.isPending) onClose(); };
  return <Drawer open title={KIND[request.kind]} onClose={close}>
    <div className="flex flex-col gap-4">
      <p className="font-semibold">{request.user.name || 'İsimsiz müşteri'} · {request.user.phone}</p>
      <p className="text-sm text-ink-muted">{request.user.email || 'E-posta belirtilmemiş'}</p>
      <div className="flex gap-2"><Badge>{STATUS[request.status]}</Badge><Badge>Bakiye: {fmtTL(request.balance)}</Badge></div>
      <p className="whitespace-pre-wrap text-sm">{request.note || 'Müşteri açıklaması yok.'}</p>
      {request.response ? <div className="rounded-chip bg-surface-sunken p-3 text-sm"><p className="font-semibold">Son yanıt</p><p className="whitespace-pre-wrap">{request.response}</p></div> : null}
      <p className="text-xs text-ink-muted">Son güncelleme: {fmtDateTime(request.updatedAt)}</p>
      {request.kind === 'CLOSURE' ? <p className="text-sm text-ink-muted">Kapatma; bakiye, devam eden sipariş, ödeme ve gönderilmiş bekleyen hediyeler çözüldükten sonra tamamlanabilir. Tamamlandığında müşteri oturumları kapatılır.</p> : <p className="text-sm text-ink-muted">Müşteriye verilerine erişim sonucunu açıklayan bir yanıt yazın.</p>}
      {canEdit && !terminal ? <div className="flex flex-wrap gap-2">
        {request.status === 'OPEN' ? <Button variant="ghost" onClick={() => { update.reset(); setDecision('IN_REVIEW'); }}>İncelemeye al</Button> : null}
        <Button variant="ghost" onClick={() => { update.reset(); setDecision('REJECTED'); }}>Reddet</Button>
        <Button onClick={() => { update.reset(); setDecision('COMPLETED'); }}>{request.kind === 'CLOSURE' ? 'Hesabı kapat ve tamamla' : 'Talebi tamamla'}</Button>
      </div> : null}
      <ReasonDialog open={decision !== null} title={decision ? STATUS[decision] : ''} description={decision === 'COMPLETED' && request.kind === 'CLOSURE' ? 'Hesabın kapatılmasını onaylıyorsunuz. Müşteriye iletilecek açıklamayı yazın.' : 'Müşteriye iletilecek açıklamayı yazın.'} confirmLabel="Yanıtı kaydet ve uygula" onConfirm={(response) => update.mutate(response)} busy={update.isPending} error={update.error?.message} onClose={() => { if (!update.isPending) setDecision(null); }} />
    </div>
  </Drawer>;
}
