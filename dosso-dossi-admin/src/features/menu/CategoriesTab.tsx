import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useId, useState } from 'react';
import { api, readApi } from '../../api/client';
import { categorySchema } from '../../api/schemas';
import { useAuth } from '../../auth/auth-state';
import {
	Field,
  MutationForm,
	Input
} from '../../components/form';
import { Button, Card, QueryError, Spinner, EmptyState, SectionTitle } from '../../components/ui';

export function CategoriesTab() {
  const { admin } = useAuth();
  const canEdit = admin?.role === 'SUPER_ADMIN' || admin?.role === 'MANAGER';
  const qc = useQueryClient();
  const formId = useId();
  const [form, setForm] = useState({ id: '', name: '', sortOrder: 0 });
  const list = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => readApi(categorySchema.array(), '/admin/menu/categories', { signal }),
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
      api(`/admin/menu/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
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
      <Card className="overflow-x-auto lg:col-span-2 p-0">
        {list.isLoading ? <Spinner /> : null}
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
        {!list.isLoading && !list.error && rows.length === 0 ? <EmptyState>Kategori bulunamadı</EmptyState> : null}
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-sunken/60 text-left text-xs tracking-wide text-ink-muted uppercase">
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
                      disabled={!canEdit || move.isPending || i === 0}
                      className="inline-flex size-7 items-center justify-center rounded-chip disabled:opacity-30 hover:bg-surface-sunken"
                      aria-label="Yukarı"
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => reorder(i, 1)}
                      disabled={!canEdit || move.isPending || i === rows.length - 1}
                      className="inline-flex size-7 items-center justify-center rounded-chip disabled:opacity-30 hover:bg-surface-sunken"
                      aria-label="Aşağı"
                    >
                      <ArrowDown size={15} aria-hidden="true" />
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
                    onClick={() => { if (window.confirm(`“${c.name}” kategorisi silinsin mi? Bu işlem geri alınamaz.`)) remove.mutate(c.id); }}
                    disabled={!canEdit || remove.isPending || c.productCount > 0}
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

      {canEdit ? <Card>
        <SectionTitle>Kategori ekle / güncelle</SectionTitle>
        <MutationForm id={formId} busy={save.isPending} onSubmit={() => save.mutate()} className="flex flex-col gap-3">
          <Field label="Kod (id)">
            <Input
              required maxLength={60} pattern=".*\S.*" value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            />
          </Field>
          <Field label="Ad">
            <Input
              required maxLength={80} pattern=".*\S.*" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Button
            type="submit"
            disabled={!canEdit || !form.id || !form.name || save.isPending}
          >
            Kaydet
          </Button>
        </MutationForm>
      </Card> : null}
      {(save.error || remove.error || move.error) ? <p role="alert" className="text-sm text-bad">{(save.error || remove.error || move.error)?.message}</p> : null}
    </div>
  );
}
