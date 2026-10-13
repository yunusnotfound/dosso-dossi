import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { ApiError, api, readApi } from '../../api/client';
import { fmtNum, fmtTL } from '../../api/format';
import type { Branch } from '../../api/schemas';
import { availabilitySchema, branchSchema } from '../../api/schemas';
import { useAuth } from '../../auth/auth-state';
import { Checkbox, Drawer, MutationForm, Field, Input } from '../../components/form';
import { DataTable, PageHeader, type Column } from '../../components/table';
import { QueryError, Spinner, EmptyState, Badge, Button, Card, SectionTitle, } from '../../components/ui';

const EMPTY: Branch = {
  id: '',
  name: '',
  address: '',
  city: 'İstanbul',
  phone: '',
  lat: 41.0,
  lng: 29.0,
  hours: '08:00–23:00',
  isOpen: true,
  prepMinutes: 7,
  orderCount: 0,
};

export function BranchesPage() {
  const { admin } = useAuth();
  const canManage = admin?.role === 'SUPER_ADMIN' || admin?.role === 'MANAGER';
  const canOperate = admin?.role !== 'VIEWER';
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [matrixFor, setMatrixFor] = useState<Branch | null>(null);

  const list = useQuery({
    queryKey: ['branches'],
    refetchInterval: 60_000,
    queryFn: ({ signal }) => readApi(branchSchema.array(), '/admin/branches', { signal }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['branches'] });

  const toggle = useMutation({
    mutationFn: (b: Branch) =>
      api(`/admin/branches/${encodeURIComponent(b.id)}/open`, {
        method: 'POST',
        body: { isOpen: !b.isOpen },
      }),
    onSuccess: refresh,
  });

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      header: 'Şube',
      render: (b) => (
        <div className="min-w-44 max-w-56 whitespace-normal break-words">
          <p className="font-semibold text-ink">{b.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{b.address}</p>
        </div>
      ),
    },
    { key: 'hours', header: 'Saatler', render: (b) => b.hours },
    {
      key: 'prep',
      header: 'Hazırlık',
      numeric: true,
      render: (b) => `${fmtNum(b.prepMinutes)} dk`,
    },
    {
      key: 'orders',
      header: 'Sipariş',
      numeric: true,
      render: (b) => fmtNum(b.orderCount),
    },
    {
      key: 'acceptance',
      header: 'Sipariş alımı',
      render: (b) => <Badge tone={b.isAcceptingOrders === true ? 'ok' : b.isAcceptingOrders === false ? 'warn' : 'neutral'}>{b.isAcceptingOrders === true ? 'Sipariş alıyor' : b.isAcceptingOrders === false ? 'Sipariş almıyor' : 'Durum bilinmiyor'}</Badge>,
    },
    {
      key: 'open',
      header: 'Manuel izin',
      render: (b) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle.mutate(b);
          }}
          disabled={!canOperate || toggle.isPending}
          title="Sipariş izni: izin verilse bile çalışma saati ve hazırlık süresi kuralları uygulanır"
          aria-label={`${b.name}: sipariş izni ${b.isOpen ? 'açık' : 'kapalı'}`}
          aria-pressed={b.isOpen}
        >
          <Badge tone={b.isOpen ? 'neutral' : 'bad'}>{b.isOpen ? 'İzin açık' : 'Durduruldu'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMatrixFor(b);
          }}
          className="text-xs font-semibold text-brand hover:underline"
        >
          Ürün müsaitliği
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Şubeler"
        subtitle="Anlık sipariş alımı çalışma saatlerini ve hazırlık süresini içerir. Manuel izin ayrıca yönetilir."
        actions={canManage ? <Button onClick={() => setEditing({ ...EMPTY })}>Yeni şube</Button> : null}
      />
      {toggle.error ? <p role="alert" className="text-sm text-bad">{toggle.error.message}</p> : null}
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(b) => b.id}
        onRowClick={canManage ? setEditing : undefined}
        loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}
      />

      <BranchDrawer
        branch={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
      <AvailabilityDrawer branch={matrixFor} onClose={() => setMatrixFor(null)} />
    </div>
  );
}

function BranchDrawer({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Branch>(EMPTY);
  const [error, setError] = useState('');
  const formId = useId();
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = branch?.id ?? '';
  if (branch && lastKey !== key) {
    setForm(branch);
    setLastKey(key);
    setError('');
  }
  if (!branch && lastKey !== null) setLastKey(null);

  const save = useMutation({
    mutationFn: () =>
      api('/admin/branches', {
        method: 'POST',
        body: {
          ...form,
          lat: Number(form.lat),
          lng: Number(form.lng),
          prepMinutes: Number(form.prepMinutes),
        },
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Kaydedilemedi'),
  });

  const set = <K extends keyof Branch>(k: K, v: Branch[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Drawer
      open={!!branch}
      title={branch?.id ? branch.name : 'Yeni şube'}
      onClose={onClose}
      busy={save.isPending}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            Kaydet
          </Button>
        </div>
      }
    >
      <MutationForm id={formId} busy={save.isPending} onSubmit={() => save.mutate()}>
        <Field label="Kod (id)">
          <Input
            required maxLength={60} pattern=".*\S.*" value={form.id}
            disabled={!!branch?.id}
            onChange={(e) => set('id', e.target.value)}
          />
        </Field>
        <Field label="Ad">
          <Input required maxLength={120} pattern=".*\S.*" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Adres">
          <Input required maxLength={300} pattern=".*\S.*" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Şehir">
            <Input required maxLength={60} pattern=".*\S.*" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Telefon">
            <Input maxLength={30} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Enlem">
            <Input
              type="number"
              step="0.000001"
              required min={-90} max={90} value={Number.isFinite(form.lat) ? form.lat : ''}
              onChange={(e) => set('lat', e.target.valueAsNumber)}
            />
          </Field>
          <Field label="Boylam">
            <Input
              type="number"
              step="0.000001"
              required min={-180} max={180} value={Number.isFinite(form.lng) ? form.lng : ''}
              onChange={(e) => set('lng', e.target.valueAsNumber)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Çalışma saatleri">
            <Input required maxLength={60} pattern=".*\S.*" value={form.hours} onChange={(e) => set('hours', e.target.value)} />
          </Field>
          <Field label="Hazırlık (dk)">
            <Input
              type="number"
              required min={0} max={120} value={Number.isFinite(form.prepMinutes) ? form.prepMinutes : ''}
              onChange={(e) => set('prepMinutes', e.target.valueAsNumber)}
            />
          </Field>
        </div>
        <Checkbox
          label="Sipariş izni açık (çalışma saatleri ayrıca uygulanır)"
          checked={form.isOpen}
          onChange={(v) => set('isOpen', v)}
        />
        {error ? (
          <p className="rounded-chip bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </MutationForm>
    </Drawer>
  );
}

function AvailabilityDrawer({
  branch,
  onClose,
}: {
  branch: Branch | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { admin } = useAuth();
  const [q, setQ] = useState('');

  const list = useQuery({
    queryKey: ['availability', branch?.id],
    queryFn: ({ signal }) => readApi(availabilitySchema.array(), `/admin/branches/${encodeURIComponent(branch!.id)}/availability`, { signal }),
    enabled: !!branch,
  });

  const set = useMutation({
    mutationFn: (p: { productId: string; isAvailable: boolean }) =>
      api(`/admin/branches/${encodeURIComponent(branch!.id)}/availability/${encodeURIComponent(p.productId)}`, {
        method: 'POST',
        body: { isAvailable: p.isAvailable },
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['availability', branch?.id] }),
  });

  const rows = (list.data ?? []).filter((r) =>
    q ? r.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')) : true,
  );

  return (
    <Drawer
      open={!!branch}
      title={`${branch?.name ?? ''} · ürün müsaitliği`}
      onClose={onClose}
      busy={set.isPending}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Kapatılan ürün bu şubede sipariş edilemez. Kayıt yoksa ürün müsait sayılır.
        </p>
        {set.error ? <p role="alert" className="text-sm text-bad">{set.error.message}</p> : null}
        {list.isLoading ? <Spinner /> : null}
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
        {!list.isLoading && !list.error && rows.length === 0 ? <EmptyState>Ürün bulunamadı</EmptyState> : null}
        <Input placeholder="Ürün ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <Card className="p-0">
          <ul>
            {rows.map((r) => (
              <li
                key={r.productId}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                  <p className="text-xs text-ink-muted">
                    {r.categoryName} · {fmtTL(r.priceOverride ?? r.basePrice)}
                    {r.priceOverride !== null ? ` (şubeye özel; genel ${fmtTL(r.basePrice)})` : ''}
                  </p>
                </div>
                <button
                  disabled={admin?.role === 'VIEWER' || set.isPending}
                  onClick={() =>
                    set.mutate({ productId: r.productId, isAvailable: !r.isAvailable })
                  }
                >
                  <Badge tone={r.isAvailable ? 'ok' : 'bad'}>
                    {r.isAvailable ? 'Var' : 'Yok'}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {rows.length === 0 ? (
          <SectionTitle>Eşleşen ürün yok</SectionTitle>
        ) : null}
      </div>
    </Drawer>
  );
}
