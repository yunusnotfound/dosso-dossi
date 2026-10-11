import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, readApi } from '../../api/client';
import type { Option } from '../../api/schemas';
import { optionSchema } from '../../api/schemas';
import { useAuth } from '../../auth/auth-state';
import { Input } from '../../components/form';
import { Badge, Button, Card, QueryError, Spinner, SectionTitle, } from '../../components/ui';

export function OptionsTab() {
  const { admin } = useAuth();
  const list = useQuery({ queryKey: ['options'], queryFn: ({ signal }) => readApi(optionSchema.array(), '/admin/menu/options', { signal }) });
  const canEdit = admin?.role === 'SUPER_ADMIN' || admin?.role === 'MANAGER';
  return <Card>
    <SectionTitle>Opsiyon fiyat farkları</SectionTitle>
    <p className="mb-4 text-sm text-ink-muted">Fiyat farkını kontrol edip Kaydet ile uygulayın. Pasif seçenekler siparişte kullanılamaz.</p>
    <div className="flex flex-col gap-2">{list.data?.map((o) => <OptionEditor key={`${o.id}:${o.priceDelta}`} option={o} canEdit={canEdit} />)}</div>
    {list.isLoading ? <Spinner /> : null}
    <QueryError error={list.error} onRetry={() => void list.refetch()} />
  </Card>;
}
function OptionEditor({ option: o, canEdit }: { option: Option; canEdit: boolean }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(o.priceDelta));
  const value = Number(price);
  const valid = price.trim() !== '' && Number.isFinite(value) && value >= -1000 && value <= 1000 && /^-?\d+(?:\.\d{1,2})?$/.test(price);
  const save = useMutation({
    mutationFn: () => api('/admin/menu/options', { method: 'POST', body: { ...o, priceDelta: value } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['options'] }),
  });
  return <form onSubmit={(e) => { e.preventDefault(); if (valid && canEdit) save.mutate(); }} className="rounded-chip bg-surface-sunken px-3 py-2">
    <div className="flex flex-wrap items-center gap-3">
      <Badge>{o.group}</Badge><span className="min-w-28 flex-1 text-sm font-medium text-ink">{o.name}</span>
      <Badge tone={o.isActive ? 'ok' : 'neutral'}>{o.isActive ? 'Aktif' : 'Pasif'}</Badge>
      <Input aria-label={`${o.name} fiyat farkı`} type="number" required min="-1000" max="1000" step="0.01" disabled={!canEdit || save.isPending} value={price} onChange={(e) => setPrice(e.target.value)} className="w-28 min-w-24 flex-none" />
      <span className="text-sm text-ink-muted">₺</span>
      {canEdit ? <Button type="submit" disabled={!valid || value === Number(o.priceDelta) || save.isPending}>Kaydet</Button> : null}
    </div>
    {save.error ? <p role="alert" className="text-sm text-bad">{save.error.message}</p> : null}
  </form>;
}
