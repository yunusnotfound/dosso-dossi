import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import {
  Checkbox,
  Drawer,
  Field,
  Input,
  Select,
  Tabs,
  Textarea,
} from '../../components/form';
import { DataTable, PageHeader, Pager, type Column } from '../../components/table';
import { Badge, Button, Card, SectionTitle, fmtNum, fmtTL } from '../../components/ui';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  productCount: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  description: string;
  imageUrl: string | null;
  sizeMl: number;
  stampMultiplier: number;
  isNew: boolean;
  isFeatured: boolean;
  hasOptions: boolean;
  isActive: boolean;
}

interface ProductList {
  page: number;
  pageSize: number;
  total: number;
  products: Product[];
}

interface Option {
  id: string;
  group: string;
  name: string;
  priceDelta: string | number;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY: Product = {
  id: '',
  name: '',
  price: 0,
  categoryId: '',
  categoryName: '',
  description: '',
  imageUrl: null,
  sizeMl: 0,
  stampMultiplier: 1,
  isNew: false,
  isFeatured: false,
  hasOptions: false,
  isActive: true,
};

export function MenuPage() {
  const [tab, setTab] = useState('products');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Menü" subtitle="Kategoriler, ürünler ve opsiyonlar" />
      <Tabs
        tabs={[
          { id: 'products', label: 'Ürünler' },
          { id: 'categories', label: 'Kategoriler' },
          { id: 'options', label: 'Opsiyonlar' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'products' ? <ProductsTab /> : null}
      {tab === 'categories' ? <CategoriesTab /> : null}
      {tab === 'options' ? <OptionsTab /> : null}
    </div>
  );
}

function ProductsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/admin/menu/categories'),
  });

  const list = useQuery({
    queryKey: ['products', { q, categoryId, page }],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (q) p.set('q', q);
      if (categoryId) p.set('categoryId', categoryId);
      return api<ProductList>(`/admin/menu/products?${p}`);
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['products'] });

  const toggle = useMutation({
    mutationFn: (p: Product) =>
      api(`/admin/menu/products/${p.id}/active`, {
        method: 'POST',
        body: { isActive: !p.isActive },
      }),
    onSuccess: refresh,
  });

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Ürün',
      render: (p) => (
        <div>
          <p className="font-semibold text-ink">{p.name}</p>
          <p className="text-xs text-ink-muted">{p.categoryName}</p>
        </div>
      ),
    },
    { key: 'price', header: 'Fiyat', numeric: true, render: (p) => fmtTL(p.price) },
    {
      key: 'stamp',
      header: 'Damga',
      numeric: true,
      render: (p) => fmtNum(p.stampMultiplier),
    },
    {
      key: 'flags',
      header: 'Etiket',
      render: (p) => (
        <div className="flex gap-1">
          {p.isNew ? <Badge tone="gold">yeni</Badge> : null}
          {p.isFeatured ? <Badge>öne çıkan</Badge> : null}
          {p.hasOptions ? <Badge>opsiyonlu</Badge> : null}
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Durum',
      render: (p) => (
        <Badge tone={p.isActive ? 'ok' : 'bad'}>{p.isActive ? 'Aktif' : 'Pasif'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle.mutate(p);
          }}
          className="text-xs font-semibold text-brand hover:underline"
        >
          {p.isActive ? 'Pasifleştir' : 'Aktifleştir'}
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Ürün ara"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="w-56"
        />
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tüm kategoriler</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => setBulkOpen(true)}>
            Toplu fiyat
          </Button>
          <Button onClick={() => setEditing({ ...EMPTY })}>Yeni ürün</Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.products}
        rowKey={(p) => p.id}
        onRowClick={setEditing}
        loading={list.isLoading}
      />
      <Pager
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? 50}
        total={list.data?.total ?? 0}
        onPage={setPage}
      />

      <ProductDrawer
        product={editing}
        categories={categories.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
      <BulkPriceDialog
        open={bulkOpen}
        categories={categories.data ?? []}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          setBulkOpen(false);
          refresh();
        }}
      />
    </>
  );
}

function ProductDrawer({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Product>(EMPTY);
  const [error, setError] = useState('');

  // Çekmece her açıldığında formu seçili ürünle doldur.
  const key = product?.id ?? '';
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (product && lastKey !== key) {
    setForm({ ...product, categoryId: product.categoryId || categories[0]?.id || '' });
    setLastKey(key);
    setError('');
  }
  if (!product && lastKey !== null) setLastKey(null);

  const save = useMutation({
    mutationFn: () =>
      api('/admin/menu/products', {
        method: 'POST',
        body: {
          ...form,
          price: Number(form.price),
          sizeMl: Number(form.sizeMl),
          stampMultiplier: Number(form.stampMultiplier),
        },
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Kaydedilemedi'),
  });

  const set = <K extends keyof Product>(k: K, v: Product[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Drawer
      open={!!product}
      title={product?.id ? product.name : 'Yeni ürün'}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Kod (id)" hint="Kaydedildikten sonra değiştirilmemeli.">
          <Input
            value={form.id}
            disabled={!!product?.id}
            onChange={(e) => set('id', e.target.value)}
          />
        </Field>
        <Field label="Ad">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fiyat (₺)">
            <Input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', Number(e.target.value))}
            />
          </Field>
          <Field label="Kategori">
            <Select
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Hacim (ml)" hint="0 = belirtilmemiş">
            <Input
              type="number"
              value={form.sizeMl}
              onChange={(e) => set('sizeMl', Number(e.target.value))}
            />
          </Field>
          <Field label="Damga çarpanı" hint="0 = damga kazandırmaz (merch)">
            <Input
              type="number"
              value={form.stampMultiplier}
              onChange={(e) => set('stampMultiplier', Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Açıklama">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <Field label="Görsel URL" hint="Boş bırakılırsa uygulama yer tutucu gösterir.">
          <Input
            value={form.imageUrl ?? ''}
            onChange={(e) => set('imageUrl', e.target.value || null)}
          />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Checkbox label="Yeni" checked={form.isNew} onChange={(v) => set('isNew', v)} />
          <Checkbox
            label="Öne çıkan"
            checked={form.isFeatured}
            onChange={(v) => set('isFeatured', v)}
          />
          <Checkbox
            label="Opsiyonlu"
            checked={form.hasOptions}
            onChange={(v) => set('hasOptions', v)}
          />
          <Checkbox
            label="Aktif"
            checked={form.isActive}
            onChange={(v) => set('isActive', v)}
          />
        </div>
        {error ? (
          <p className="rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}

function BulkPriceDialog({
  open,
  categories,
  onClose,
  onDone,
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState(10);
  const [roundTo, setRoundTo] = useState(5);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const run = useMutation({
    mutationFn: () =>
      api<{ updated: number }>('/admin/menu/bulk-price', {
        method: 'POST',
        body: {
          categoryId: categoryId || undefined,
          [mode]: Number(value),
          roundTo: Number(roundTo),
          reason,
        },
      }),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Uygulanamadı'),
  });

  if (!open) return null;
  return (
    <Drawer
      open={open}
      title="Toplu fiyat güncelleme"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            onClick={() => run.mutate()}
            disabled={reason.trim().length < 5 || run.isPending}
          >
            {run.isPending ? 'Uygulanıyor…' : 'Fiyatları güncelle'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
          <Field label="Kapsam">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tüm ürünler</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.productCount})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Yöntem">
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'percent' | 'amount')}
            >
              <option value="percent">Yüzde (%)</option>
              <option value="amount">Sabit tutar (₺)</option>
            </Select>
          </Field>
          <Field label={mode === 'percent' ? 'Oran (%)' : 'Tutar (₺)'}>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </Field>
          <Field label="Yuvarlama" hint="5 ⇒ en yakın 5 ₺'ye. 0 = yuvarlama yok.">
            <Input
              type="number"
              value={roundTo}
              onChange={(e) => setRoundTo(Number(e.target.value))}
            />
          </Field>
        <p className="rounded-[--radius-chip] bg-warn-soft px-3 py-2 text-sm text-warn">
          Bu işlem seçilen kapsamdaki tüm fiyatları değiştirir. Etkilenen her
          ürünün öncesi/sonrası tek bir kayıt olarak izlenir.
        </p>
        <Field label="Gerekçe" hint="En az 5 karakter — kayda geçer.">
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {error ? (
          <p className="rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ id: '', name: '', sortOrder: 0 });
  const list = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/admin/menu/categories'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['categories'] });

  const save = useMutation({
    mutationFn: () =>
      api('/admin/menu/categories', { method: 'POST', body: form }),
    onSuccess: () => {
      setForm({ id: '', name: '', sortOrder: 0 });
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/menu/categories/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  const move = useMutation({
    mutationFn: (ids: string[]) =>
      api('/admin/menu/categories/reorder', { method: 'POST', body: { ids } }),
    onSuccess: refresh,
  });

  const rows = list.data ?? [];
  const reorder = (index: number, dir: -1 | 1) => {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    move.mutate(next.map((c) => c.id));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2 p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs tracking-wide text-ink-muted uppercase">
              <th className="px-5 py-3 font-semibold">Sıra</th>
              <th className="px-5 py-3 font-semibold">Kategori</th>
              <th className="px-5 py-3 text-right font-semibold">Ürün</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => reorder(i, -1)}
                      disabled={i === 0}
                      className="rounded px-1 disabled:opacity-30 hover:bg-surface-sunken"
                      aria-label="Yukarı"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => reorder(i, 1)}
                      disabled={i === rows.length - 1}
                      className="rounded px-1 disabled:opacity-30 hover:bg-surface-sunken"
                      aria-label="Aşağı"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">{c.id}</p>
                </td>
                <td className="tnum px-5 py-3 text-right">{c.productCount}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => remove.mutate(c.id)}
                    disabled={c.productCount > 0}
                    title={c.productCount > 0 ? 'Önce ürünleri taşıyın' : 'Sil'}
                    className="text-xs font-semibold text-bad disabled:opacity-30 hover:underline"
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <SectionTitle>Kategori ekle / güncelle</SectionTitle>
        <div className="flex flex-col gap-3">
          <Field label="Kod (id)">
            <Input
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            />
          </Field>
          <Field label="Ad">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Button
            onClick={() => save.mutate()}
            disabled={!form.id || !form.name || save.isPending}
          >
            Kaydet
          </Button>
        </div>
      </Card>
    </div>
  );
}

function OptionsTab() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['options'],
    queryFn: () => api<Option[]>('/admin/menu/options'),
  });
  const save = useMutation({
    mutationFn: (o: Partial<Option>) =>
      api('/admin/menu/options', {
        method: 'POST',
        body: {
          id: o.id,
          group: o.group,
          name: o.name,
          priceDelta: Number(o.priceDelta),
          sortOrder: o.sortOrder ?? 0,
          isActive: o.isActive ?? true,
        },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['options'] }),
  });

  return (
    <Card>
      <SectionTitle>Opsiyon fiyat farkları</SectionTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Sipariş fiyatlaması bu tablodan okunur; değişiklik en geç 30 saniyede
        uygulamaya yansır.
      </p>
      <div className="flex flex-col gap-2">
        {list.data?.map((o) => (
          <div
            key={o.id}
            className="flex items-center gap-3 rounded-[--radius-chip] bg-surface-sunken px-3 py-2"
          >
            <Badge>{o.group}</Badge>
            <span className="flex-1 text-sm font-medium text-ink">{o.name}</span>
            <Input
              type="number"
              defaultValue={Number(o.priceDelta)}
              onBlur={(e) =>
                save.mutate({ ...o, priceDelta: Number(e.target.value) })
              }
              className="w-28"
            />
            <span className="text-sm text-ink-muted">₺</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
