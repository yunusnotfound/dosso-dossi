import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { ApiError, api } from '../../api/client';
import type { Category, Product } from '../../api/schemas';
import {
  Checkbox,
  Drawer,
  MutationForm,
  Field,
  Input,
  Select,
  Textarea,
} from '../../components/form';
import { Button, SectionTitle } from '../../components/ui';
import { EMPTY } from './defaults';
import { ProductImage } from './ProductImage';

export function ProductDrawer({
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
  const [sameImage, setSameImage] = useState(true);
  const [error, setError] = useState('');
  const formId = useId();

  // Çekmece her açıldığında formu seçili ürünle doldur.
  const key = product?.id ?? '';
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (product && lastKey !== key) {
    setForm({ ...product, gridImageUrl: product.gridImageUrl ?? null, categoryId: product.categoryId || categories[0]?.id || '' });
    setSameImage(!product.gridImageUrl || product.gridImageUrl === product.imageUrl);
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
          gridImageUrl: sameImage ? null : form.gridImageUrl,
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
      busy={save.isPending}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      }
    >
      <MutationForm id={formId} busy={save.isPending} onSubmit={() => save.mutate()}>
        <SectionTitle>Ürün bilgileri</SectionTitle>
        <Field label="Kod (id)" hint="Kaydedildikten sonra değiştirilmemeli.">
          <Input
            required maxLength={80} pattern=".*\S.*"
            value={form.id}
            disabled={!!product?.id}
            onChange={(e) => set('id', e.target.value)}
          />
        </Field>
        <Field label="Ad">
          <Input required maxLength={120} pattern=".*\S.*" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fiyat (₺)">
            <Input
              type="number"
              step="0.01" min={0} max={100000} required
              value={Number.isFinite(form.price) ? form.price : ''}
              onChange={(e) => set('price', e.target.valueAsNumber)}
            />
          </Field>
          <Field label="Kategori">
            <Select
              required
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
              required min={0} max={5000} step={1}
              value={Number.isFinite(form.sizeMl) ? form.sizeMl : ''}
              onChange={(e) => set('sizeMl', e.target.valueAsNumber)}
            />
          </Field>
          <Field label="Damga çarpanı" hint="0 = damga kazandırmaz (merch)">
            <Input
              type="number"
              required min={0} max={10} step={1}
              value={Number.isFinite(form.stampMultiplier) ? form.stampMultiplier : ''}
              onChange={(e) => set('stampMultiplier', e.target.valueAsNumber)}
            />
          </Field>
        </div>
        <Field label="Açıklama">
          <Textarea
            rows={3} maxLength={500}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <div className="mt-2 border-t border-line pt-5">
          <SectionTitle>Ürün görselleri</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <figure className="flex flex-col items-center gap-2 rounded-chip border border-line bg-surface p-3">
              <ProductImage imageUrl={sameImage ? form.imageUrl : form.gridImageUrl} fallbackUrl={form.imageUrl} className="h-24 w-full border-0" />
              <figcaption className="text-xs font-medium text-ink-muted">Liste görünümü</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-2 rounded-chip border border-line bg-surface p-3">
              <ProductImage imageUrl={form.imageUrl} className="h-24 w-full border-0" />
              <figcaption className="text-xs font-medium text-ink-muted">Detay görünümü</figcaption>
            </figure>
          </div>
        </div>
        <Field label="Detay görseli URL" hint="Yeni dosya için farklı veya sürümlü bir URL kullanın. Boşsa yer tutucu gösterilir.">
          <Input
            maxLength={500}
            value={form.imageUrl ?? ''}
            onChange={(e) => set('imageUrl', e.target.value || null)}
          />
        </Field>
        <Checkbox label="Liste ve detayda aynı görseli kullan" checked={sameImage} onChange={setSameImage} />
        {sameImage ? <p className="text-xs text-ink-muted">Eski liste görseli temizlenir; sipariş ve hediye listeleri detay görselini kullanır.</p> : (
          <Field label="Liste görseli URL" hint="Sipariş ve hediye listelerinde bu görsel kullanılır. Detay görselini değiştirirken bu alanı da kontrol edin. Boşsa detay görseline dönülür.">
            <Input maxLength={500} value={form.gridImageUrl ?? ''} onChange={(e) => set('gridImageUrl', e.target.value.trim() || null)} />
          </Field>
        )}
        <div className="mt-1 border-t border-line pt-5">
          <SectionTitle>Görünürlük & etiketler</SectionTitle>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
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
        </div>
        {error ? (
          <p className="rounded-chip bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </MutationForm>
    </Drawer>
  );
}
