import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import { Checkbox, Drawer, Field, Input } from '../../components/form';
import { DataTable, PageHeader, type Column } from '../../components/table';
import { Badge, Button, Card, SectionTitle, fmtNum, fmtTL } from '../../components/ui';

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  lat: number;
  lng: number;
  hours: string;
  isOpen: boolean;
  prepMinutes: number;
  orderCount: number;
}

interface Availability {
  productId: string;
  name: string;
  categoryName: string;
  basePrice: number;
  isAvailable: boolean;
  priceOverride: number | null;
}

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
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [matrixFor, setMatrixFor] = useState<Branch | null>(null);

  const list = useQuery({
    queryKey: ['branches'],
    queryFn: () => api<Branch[]>('/admin/branches'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['branches'] });

  const toggle = useMutation({
    mutationFn: (b: Branch) =>
      api(`/admin/branches/${b.id}/open`, {
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
        <div>
          <p className="font-semibold text-ink">{b.name}</p>
          <p className="text-xs text-ink-muted">{b.address}</p>
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
      key: 'open',
      header: 'Durum',
      render: (b) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle.mutate(b);
          }}
          title="Anlık açık/kapalı — kapalı şube sipariş alamaz"
        >
          <Badge tone={b.isOpen ? 'ok' : 'bad'}>{b.isOpen ? 'Açık' : 'Kapalı'}</Badge>
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
        subtitle="Bilgiler, çalışma durumu ve ürün müsaitliği"
        actions={<Button onClick={() => setEditing({ ...EMPTY })}>Yeni şube</Button>}
      />
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(b) => b.id}
        onRowClick={setEditing}
        loading={list.isLoading}
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
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Kod (id)">
          <Input
            value={form.id}
            disabled={!!branch?.id}
            onChange={(e) => set('id', e.target.value)}
          />
        </Field>
        <Field label="Ad">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Adres">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Şehir">
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Telefon">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Enlem">
            <Input
              type="number"
              step="0.000001"
              value={form.lat}
              onChange={(e) => set('lat', Number(e.target.value))}
            />
          </Field>
          <Field label="Boylam">
            <Input
              type="number"
              step="0.000001"
              value={form.lng}
              onChange={(e) => set('lng', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Çalışma saatleri">
            <Input value={form.hours} onChange={(e) => set('hours', e.target.value)} />
          </Field>
          <Field label="Hazırlık (dk)">
            <Input
              type="number"
              value={form.prepMinutes}
              onChange={(e) => set('prepMinutes', Number(e.target.value))}
            />
          </Field>
        </div>
        <Checkbox
          label="Şube açık (kapalıyken sipariş alınmaz)"
          checked={form.isOpen}
          onChange={(v) => set('isOpen', v)}
        />
        {error ? (
          <p className="rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
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
  const [q, setQ] = useState('');

  const list = useQuery({
    queryKey: ['availability', branch?.id],
    queryFn: () => api<Availability[]>(`/admin/branches/${branch!.id}/availability`),
    enabled: !!branch,
  });

  const set = useMutation({
    mutationFn: (p: { productId: string; isAvailable: boolean }) =>
      api(`/admin/branches/${branch!.id}/availability/${p.productId}`, {
        method: 'POST',
        body: { isAvailable: p.isAvailable, priceOverride: null },
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
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Kapatılan ürün bu şubede sipariş edilemez. Kayıt yoksa ürün müsait sayılır.
        </p>
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
                    {r.categoryName} · {fmtTL(r.basePrice)}
                  </p>
                </div>
                <button
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
