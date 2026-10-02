import { useEffect, useRef, useState } from 'react';
import { api, tokens, upload } from '../../api/client';
import { Checkbox, Drawer, Field, Input, Select, Textarea } from '../../components/form';
import { Badge, Button } from '../../components/ui';
import { StoryThumbnail } from './StoryThumbnail';
import { STORY_ACTIONS, hasBuiltInArtwork, isoDateTime, localDateTime, storyError, type StoryAction, type StoryInput } from './stories';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export function StoryDrawer({ initial, onClose, onSaved }: { initial: StoryInput; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<StoryInput>({ ...initial });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [session] = useState(tokens.session);
  const alive = useRef(true);
  const inFlight = useRef(new Set<AbortController>());
  const uploadRequest = useRef<AbortController | null>(null);
  const current = () => alive.current && tokens.session === session;
  const cancel = () => {
    alive.current = false;
    for (const controller of inFlight.current) controller.abort();
    inFlight.current.clear();
  };
  useEffect(() => {
    alive.current = true;
    const controllers = inFlight.current;
    return () => { alive.current = false; for (const controller of controllers) controller.abort(); controllers.clear(); };
  }, []);
  const close = () => { cancel(); onClose(); };
  const set = <K extends keyof StoryInput>(key: K, value: StoryInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setError('');
  };
  const uploadImage = async (file: File | undefined) => {
    if (!file || !current()) return;
    uploadRequest.current?.abort();
    uploadRequest.current = null;
    if (!IMAGE_TYPES.has(file.type) || file.size === 0) { setUploading(false); setError('PNG, JPEG veya WebP biçiminde bir görsel seçin.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setUploading(false); setError('Görsel en fazla 10 MB olabilir.'); return; }
    const controller = new AbortController();
    uploadRequest.current = controller;
    inFlight.current.add(controller);
    setUploading(true); setError('');
    try {
      const result = await upload<{ imageUrl: string }>('/admin/campaign-stories/image', file, controller.signal);
      if (current() && uploadRequest.current === controller) setForm((previous) => ({ ...previous, imageUrl: result.imageUrl }));
    } catch (err) {
      if (current() && uploadRequest.current === controller && !controller.signal.aborted) setError(err instanceof Error ? err.message : 'Görsel yüklenemedi.');
    } finally {
      inFlight.current.delete(controller);
      if (current() && uploadRequest.current === controller) { uploadRequest.current = null; setUploading(false); }
    }
  };
  const save = async () => {
    if (saving || uploading || !current()) return;
    const input = { ...form, title: form.title.trim(), imageUrl: form.imageUrl.trim(), actionLabel: form.actionLabel.trim() };
    const invalid = storyError(input);
    if (invalid) { setError(invalid); return; }
    const controller = new AbortController();
    inFlight.current.add(controller);
    setSaving(true); setError('');
    try {
      await api('/admin/campaign-stories', { method: 'POST', body: input, signal: controller.signal });
      if (current()) onSaved();
    } catch (err) {
      if (current() && !controller.signal.aborted) setError(err instanceof Error ? err.message : 'Hikâye kaydedilemedi.');
    } finally {
      inFlight.current.delete(controller);
      if (current()) setSaving(false);
    }
  };
  return <Drawer open title={initial.id ? 'Hikâyeyi düzenle' : 'Yeni hikâye'} onClose={close} footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}>Vazgeç</Button><Button onClick={() => void save()} disabled={saving || uploading}>{saving ? 'Kaydediliyor…' : 'Hikâyeyi kaydet'}</Button></div>}>
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 rounded-[--radius-card] bg-surface p-4"><StoryThumbnail {...form} /><div><Badge tone="gold">Ana sayfa önizlemesi</Badge><p className="mt-2 font-semibold text-ink">{form.title || 'Hikâye başlığı'}</p><p className="mt-1 text-xs text-ink-muted">Misafirler ve üyeler görebilir.</p></div></div>
      <Field label="Hikâye başlığı" hint="Dairenin altında görünür. En fazla 60 karakter."><Input autoFocus maxLength={60} value={form.title} disabled={saving} onChange={(e) => set('title', e.target.value)} /></Field>
      <Field label="Hikâye açıklaması" hint="Hikâye açıldığında gösterilir. En fazla 400 karakter."><Textarea rows={3} maxLength={400} value={form.description} disabled={saving} onChange={(e) => set('description', e.target.value)} /></Field>
      <Field label="Bağlantı hedefi"><Select value={form.action} disabled={saving} onChange={(e) => set('action', e.target.value as StoryAction)}>{Object.entries(STORY_ACTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      {form.action !== 'none' ? <Field label="Düğme metni"><Input maxLength={40} value={form.actionLabel} disabled={saving} onChange={(e) => set('actionLabel', e.target.value)} /></Field> : null}
      <div className="flex flex-col gap-3 rounded-[--radius-card] bg-surface p-4">
        <Field label="Görsel yükle" hint="PNG, JPEG veya WebP · En fazla 10 MB. Dairede kırpılır; hikâye açıldığında görselin tamamı gösterilir."><Input aria-label="Görsel yükle" type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={(e) => { void uploadImage(e.target.files?.[0]); e.target.value = ''; }} /></Field>
        {uploading ? <p role="status" className="text-sm text-brand">Görsel yükleniyor…</p> : null}
        <Field label="Görsel adresi" hint={hasBuiltInArtwork(form.action) ? 'Boş bırakılırsa mevcut kampanyanın uygulamadaki tasarımı kullanılır.' : 'Görsel yükleyin veya bir HTTPS görsel adresi girin.'}><Input type="url" maxLength={2048} value={form.imageUrl} disabled={saving || uploading} placeholder="https://… veya yüklenen görsel" onChange={(e) => set('imageUrl', e.target.value)} /></Field>
        {form.imageUrl && hasBuiltInArtwork(form.action) ? <Button variant="ghost" disabled={saving || uploading} onClick={() => set('imageUrl', '')}>Kampanyanın kendi görselini kullan</Button> : null}
      </div>
      <Field label="Gösterim sırası" hint="Küçük sayı önce gösterilir (0–999)."><Input type="number" min={0} max={999} step={1} value={Number.isFinite(form.sortOrder) ? form.sortOrder : ''} disabled={saving} onChange={(e) => set('sortOrder', e.target.value === '' ? Number.NaN : Number(e.target.value))} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Yayın başlangıcı"><Input type="datetime-local" value={localDateTime(form.startsAt)} disabled={saving} onChange={(e) => set('startsAt', isoDateTime(e.target.value))} /></Field><Field label="Yayın bitişi"><Input type="datetime-local" value={localDateTime(form.endsAt)} disabled={saving} onChange={(e) => set('endsAt', isoDateTime(e.target.value))} /></Field></div>
      <p className="-mt-3 text-xs text-ink-muted">Tarihler cihazınızın yerel saatine göredir. Bitiş boşsa hikâye süresiz kalır; 24 saatte otomatik silinmez.</p>
      <Checkbox label="Uygulamada yayınla" checked={form.isActive} disabled={saving} onChange={(value) => set('isActive', value)} />
      {error ? <p role="alert" className="rounded-[--radius-chip] bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p> : null}
    </div>
  </Drawer>;
}
