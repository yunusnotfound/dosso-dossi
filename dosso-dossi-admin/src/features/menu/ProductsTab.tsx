import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useDebouncedValue } from '../../api/use-debounced-value';
import { api, readApi } from '../../api/client';
import { fmtNum, fmtTL } from '../../api/format';
import type { Product } from '../../api/schemas';
import { categorySchema, productListSchema } from '../../api/schemas';
import { useAuth } from '../../auth/auth-state';
import { Input, Select } from '../../components/form';
import { DataTable, Pager, type Column } from '../../components/table';
import { QueryError, Badge, Button } from '../../components/ui';

import { BulkPriceDialog } from './BulkPriceDialog';
import { EMPTY } from './defaults';
import { ProductDrawer } from './ProductDrawer';
import { ProductImage } from './ProductImage';

export function ProductsTab() {
  const { admin } = useAuth();
  const canEdit = admin?.role === 'SUPER_ADMIN' || admin?.role === 'MANAGER';
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const search = useDebouncedValue(q.trim());
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => readApi(categorySchema.array(), '/admin/menu/categories', { signal }),
  });

  const list = useQuery({
    queryKey: ['products', { q: search, categoryId, status, page }],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (search) p.set('q', search);
      if (categoryId) p.set('categoryId', categoryId);
      if (status !== 'all') p.set('isActive', String(status === 'active'));
      return readApi(productListSchema, `/admin/menu/products?${p}`, { signal });
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
        <div className="flex min-w-52 items-center gap-3">
          <ProductImage imageUrl={p.gridImageUrl} fallbackUrl={p.imageUrl} />
          <div>
            <p className="font-medium text-ink">{p.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{p.categoryName}</p>
          </div>
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
        <div className="flex max-w-56 flex-wrap gap-1.5">
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
      header: 'İşlem',
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggle.mutate(p);
            }}
            disabled={!canEdit || toggle.isPending}
            className="rounded-chip px-2 py-2 text-xs font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {p.isActive ? 'Pasifleştir' : 'Aktifleştir'}
          </button>
          {canEdit ? (
            <button
              type="button"
              aria-label={`${p.name} düzenle`}
              title="Ürünü düzenle"
              onClick={(e) => { e.stopPropagation(); setEditing(p); }}
              className="rounded-chip border border-line bg-surface p-2 text-ink-muted transition hover:border-brand/40 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Pencil size={15} strokeWidth={1.7} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search size={16} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <Input
            aria-label="Ürün ara"
            placeholder="Ürün ara"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10"
          />
        </div>
        <Select
          aria-label="Ürün kategorisi"
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
        <Select
          aria-label="Ürün durumu"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="active">Aktif ürünler</option>
          <option value="inactive">Pasif ürünler</option>
          <option value="all">Tüm ürünler</option>
        </Select>
        {canEdit ? <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="ghost" onClick={() => setBulkOpen(true)}>
            <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
            Toplu fiyat
          </Button>
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
            Yeni ürün
          </Button>
        </div> : null}
      </div>
      <QueryError error={categories.error} onRetry={() => void categories.refetch()} />
      {toggle.error ? <p role="alert" className="text-sm text-bad">{toggle.error.message}</p> : null}
      <DataTable
        columns={columns}
        rows={list.data?.products}
        rowKey={(p) => p.id}
        onRowClick={canEdit ? setEditing : undefined}
        loading={list.isLoading} error={list.error} onRetry={() => void list.refetch()}
      />
      <Pager
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? 50}
        total={list.data?.total}
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
