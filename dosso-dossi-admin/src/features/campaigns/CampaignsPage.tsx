import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import { Checkbox, Drawer, Field, Input, Select, Tabs, Textarea } from '../../components/form';
import { DataTable, PageHeader, type Column } from '../../components/table';
import { Badge, Button, Card, SectionTitle, fmtNum, fmtTL } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';

interface Campaign {
  id: string;
  title: string;
  badge: string;
  description: string;
  style: 'orange' | 'dark';
  sortOrder: number;
  isActive: boolean;
}

interface Promo {
  code: string;
  discountRate: number;
  isActive: boolean;
  expiresAt: string | null;
  usageCount: number;
  totalDiscount: number;
}

const EMPTY: Campaign = {
  id: '',
  title: '',
  badge: '',
  description: '',
  style: 'orange',
  sortOrder: 0,
  isActive: true,
};

export function CampaignsPage() {
  const [tab, setTab] = useState('campaigns');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kampanyalar" subtitle="Kampanyalar, promosyon kodları ve sadakat kuralları" />
      <Tabs
        tabs={[
          { id: 'campaigns', label: 'Kampanyalar' },
          { id: 'promos', label: 'Promosyon kodları' },
          { id: 'loyalty', label: 'Sadakat kuralları' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'campaigns' ? <CampaignsTab /> : null}
      {tab === 'promos' ? <PromosTab /> : null}
      {tab === 'loyalty' ? <LoyaltyTab /> : null}
    </div>
  );
}

function CampaignsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Campaign | null>(null);

  const list = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<Campaign[]>('/admin/campaigns'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['campaigns'] });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const columns: Column<Campaign>[] = [
    {
      key: 'title',
      header: 'Kampanya',
      render: (c) => (
        <div>
          <p className="font-semibold text-ink">{c.title}</p>
          <p className="text-xs text-ink-muted">{c.id}</p>
        </div>
      ),
    },
    { key: 'badge', header: 'Rozet', render: (c) => <Badge tone="gold">{c.badge}</Badge> },
    {
      key: 'desc',
      header: 'Açıklama',
      render: (c) => <span className="text-ink-muted">{c.description}</span>,
    },
    { key: 'order', header: 'Sıra', numeric: true, render: (c) => fmtNum(c.sortOrder) },
    {
      key: 'active',
      header: 'Durum',
      render: (c) => (
        <Badge tone={c.isActive ? 'ok' : 'neutral'}>{c.isActive ? 'Aktif' : 'Pasif'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            remove.mutate(c.id);
          }}
          className="text-xs font-semibold text-bad hover:underline"
        >
          Sil
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY })}>Yeni kampanya</Button>
      </div>
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(c) => c.id}
        onRowClick={setEditing}
        loading={list.isLoading}
      />
      <CampaignDrawer
        campaign={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </>
  );
}

function CampaignDrawer({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Campaign>(EMPTY);
  const [error, setError] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = campaign?.id ?? '';
  if (campaign && lastKey !== key) {
    setForm(campaign);
    setLastKey(key);
    setError('');
  }
  if (!campaign && lastKey !== null) setLastKey(null);

  const save = useMutation({
    mutationFn: () =>
      api('/admin/campaigns', {
        method: 'POST',
        body: { ...form, sortOrder: Number(form.sortOrder) },
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Kaydedilemedi'),
  });

  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Drawer
      open={!!campaign}
      title={campaign?.id ? campaign.title : 'Yeni kampanya'}
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
            disabled={!!campaign?.id}
            onChange={(e) => set('id', e.target.value)}
          />
        </Field>
        <Field label="Başlık">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Rozet" hint='Kart üstündeki kısa etiket: "5+1", "+5 ☕"'>
          <Input value={form.badge} onChange={(e) => set('badge', e.target.value)} />
        </Field>
        <Field label="Açıklama">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Stil">
            <Select
              value={form.style}
              onChange={(e) => set('style', e.target.value as 'orange' | 'dark')}
            >
              <option value="orange">Turuncu</option>
              <option value="dark">Koyu</option>
            </Select>
          </Field>
          <Field label="Sıra">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
            />
          </Field>
        </div>
        <Checkbox
          label="Uygulamada göster"
          checked={form.isActive}
          onChange={(v) => set('isActive', v)}
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

function PromosTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: '', rate: 10, isActive: true });
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['promos'],
    queryFn: () => api<Promo[]>('/admin/promos'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['promos'] });

  const save = useMutation({
    mutationFn: () =>
      api('/admin/promos', {
        method: 'POST',
        body: {
          code: form.code,
          // Panelde yüzde girilir, sözleşme oran bekler (10 → 0.10)
          discountRate: Number(form.rate) / 100,
          isActive: form.isActive,
          expiresAt: null,
        },
      }),
    onSuccess: () => {
      setForm({ code: '', rate: 10, isActive: true });
      setError('');
      refresh();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Kaydedilemedi'),
  });
  const remove = useMutation({
    mutationFn: (code: string) => api(`/admin/promos/${code}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const columns: Column<Promo>[] = [
    { key: 'code', header: 'Kod', render: (p) => <span className="font-semibold">{p.code}</span> },
    {
      key: 'rate',
      header: 'İndirim',
      numeric: true,
      render: (p) => `%${Math.round(p.discountRate * 100)}`,
    },
    { key: 'usage', header: 'Kullanım', numeric: true, render: (p) => fmtNum(p.usageCount) },
    {
      key: 'total',
      header: 'Toplam indirim',
      numeric: true,
      render: (p) => fmtTL(p.totalDiscount),
    },
    {
      key: 'active',
      header: 'Durum',
      render: (p) => (
        <Badge tone={p.isActive ? 'ok' : 'neutral'}>{p.isActive ? 'Aktif' : 'Pasif'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <button
          onClick={() => remove.mutate(p.code)}
          className="text-xs font-semibold text-bad hover:underline"
        >
          Sil
        </button>
      ),
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <DataTable
          columns={columns}
          rows={list.data}
          rowKey={(p) => p.code}
          loading={list.isLoading}
        />
      </div>
      <Card>
        <SectionTitle>Kod ekle</SectionTitle>
        <div className="flex flex-col gap-3">
          <Field label="Kod">
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </Field>
          <Field label="İndirim (%)">
            <Input
              type="number"
              value={form.rate}
              onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) }))}
            />
          </Field>
          <Checkbox
            label="Aktif"
            checked={form.isActive}
            onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          />
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          <Button onClick={() => save.mutate()} disabled={!form.code || save.isPending}>
            Kaydet
          </Button>
        </div>
      </Card>
    </div>
  );
}

const SETTING_LABELS: Record<string, { label: string; hint: string }> = {
  'loyalty.stampTarget': {
    label: 'Damga hedefi',
    hint: 'Kaç damgada bir ikram kahve verilir.',
  },
  'loyalty.topUpBonusThreshold': {
    label: 'Yükleme eşiği (₺)',
    hint: 'Bu tutar ve üzeri yüklemede ikram verilir.',
  },
  'loyalty.topUpBonusDrinks': {
    label: 'Yükleme ikramı (adet)',
    hint: 'Eşiği geçen yüklemede verilecek ikram kahve sayısı.',
  },
  'loyalty.topUpBonusFirstOnly': {
    label: 'Yalnız ilk yükleme',
    hint: 'Açıkken ikram sadece hesabın ilk yüklemesinde verilir (tek seferlik).',
  },
};

function LoyaltyTab() {
  const { admin } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<Record<string, unknown>>('/admin/settings'),
  });
  const save = useMutation({
    mutationFn: (p: { key: string; value: unknown }) =>
      api('/admin/settings', { method: 'POST', body: p }),
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Kaydedilemedi'),
  });

  const canEdit = admin?.role === 'SUPER_ADMIN';

  return (
    <Card>
      <SectionTitle>Sadakat ve yükleme kuralları</SectionTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Bu değerler uygulamanın ve backend'in davranışını doğrudan belirler; her
        değişiklik kim yaptı bilgisiyle kayda geçer.
        {canEdit ? null : ' Değiştirmek için süper yönetici yetkisi gerekir.'}
      </p>

      <div className="flex flex-col gap-4">
        {Object.entries(settings.data ?? {}).map(([key, value]) => {
          const meta = SETTING_LABELS[key] ?? { label: key, hint: '' };
          const isBool = typeof value === 'boolean';
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-[--radius-chip] bg-surface-sunken px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{meta.label}</p>
                <p className="text-xs text-ink-muted">{meta.hint}</p>
              </div>
              {isBool ? (
                <Checkbox
                  label={value ? 'Açık' : 'Kapalı'}
                  checked={value as boolean}
                  onChange={(v) => canEdit && save.mutate({ key, value: v })}
                />
              ) : (
                <Input
                  type="number"
                  disabled={!canEdit}
                  defaultValue={Number(value)}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (next !== Number(value)) save.mutate({ key, value: next });
                  }}
                  className="w-32"
                />
              )}
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="mt-3 rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
