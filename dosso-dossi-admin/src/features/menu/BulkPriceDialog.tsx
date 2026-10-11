import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { DurableIntentError, withDurableIntent } from '../../api/mutation-intents';
import { useAuth } from '../../auth/auth-state';
import { ApiError, readApi } from '../../api/client';
import type { Category } from '../../api/schemas';
import { bulkPriceResultSchema } from '../../api/schemas';
import {
	Drawer,
	Field,
	Input,
	Select,
	Textarea
} from '../../components/form';
import { Button } from '../../components/ui';

export function BulkPriceDialog({
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
  const { admin } = useAuth();
  const [categoryId, setCategoryId] = useState('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState(10);
  const [roundTo, setRoundTo] = useState(5);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const run = useMutation({
    mutationFn: () => {
      const body = { categoryId: categoryId || undefined, [mode]: Number(value), roundTo: Number(roundTo), reason: reason.trim() };
      return withDurableIntent(`${admin!.id}:/admin/menu/bulk-price`, body, (idempotencyKey) => readApi(bulkPriceResultSchema, '/admin/menu/bulk-price', {
        method: 'POST', body: { ...body, idempotencyKey },
      }));
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError || e instanceof DurableIntentError ? e.message : 'Uygulanamadı'),
  });

  if (!open) return null;
  return (
    <Drawer
      open={open}
      title="Toplu fiyat güncelleme"
      onClose={() => { if (!run.isPending) onClose(); }}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={run.isPending} onClick={onClose}>
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
            <Select disabled={run.isPending} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
              disabled={run.isPending}
              value={mode}
              onChange={(e) => setMode(e.target.value as 'percent' | 'amount')}
            >
              <option value="percent">Yüzde (%)</option>
              <option value="amount">Sabit tutar (₺)</option>
            </Select>
          </Field>
          <Field label={mode === 'percent' ? 'Oran (%)' : 'Tutar (₺)'}>
            <Input
              disabled={run.isPending}
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </Field>
          <Field label="Yuvarlama" hint="5 ⇒ en yakın 5 ₺'ye. 0 = yuvarlama yok.">
            <Input
              disabled={run.isPending}
              type="number"
              value={roundTo}
              onChange={(e) => setRoundTo(Number(e.target.value))}
            />
          </Field>
        <p className="rounded-chip bg-warn-soft px-3 py-2 text-sm text-warn">
          Bu işlem seçilen kapsamdaki tüm fiyatları değiştirir. Etkilenen her
          ürünün öncesi/sonrası tek bir kayıt olarak izlenir.
        </p>
        <Field label="Gerekçe" hint="En az 5 karakter — kayda geçer.">
          <Textarea
            disabled={run.isPending}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {error ? (
          <p className="rounded-chip bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
