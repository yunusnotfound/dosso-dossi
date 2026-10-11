import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/auth-state';
import { Drawer, Field, Input } from '../../components/form';
import { Button, Card } from '../../components/ui';

export function ChangePassword({ onClose, required = false }: { onClose: () => void; required?: boolean }) {
  const { admin, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = <form className="flex flex-col gap-4" onSubmit={async (event) => {
    event.preventDefault();
    if (newPassword !== confirmation) { setError('Yeni şifreler eşleşmiyor.'); return; }
    if (newPassword === currentPassword) { setError('Yeni şifreniz mevcut şifrenizden farklı olmalı.'); return; }
    setBusy(true); setError('');
    try {
      await api('/admin/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
      await logout('Şifreniz değiştirildi ve mevcut oturumlarınız kapatıldı. Yeni şifrenizle giriş yapın.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Şifre değiştirilemedi'); }
    finally { setBusy(false); }
  }}>
    <p className="text-sm text-ink-muted">{required ? 'Panele erişmek için geçici şifrenizi değiştirin. ' : ''}Değişiklik kaydedilince açık oturumlarınız kapatılır. Yeni şifrenizle yeniden giriş yapın.</p>
    {required && admin?.tempPasswordExpiresAt ? <p className="text-sm text-ink-muted">Geçici şifre son kullanım: {new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(admin.tempPasswordExpiresAt))} (İstanbul)</p> : null}
    <Field label={required ? 'Geçici şifre' : 'Mevcut şifre'}><Input type="password" autoComplete="current-password" required autoFocus disabled={busy} maxLength={200} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
    <Field label="Yeni şifre" hint="En az 12 karakter."><Input type="password" autoComplete="new-password" required disabled={busy} minLength={12} maxLength={200} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
    <Field label="Yeni şifre (tekrar)"><Input type="password" autoComplete="new-password" required disabled={busy} minLength={12} maxLength={200} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
    {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
    <Button type="submit" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Şifreyi değiştir ve çıkış yap'}</Button>
    {required ? <Button variant="ghost" disabled={busy} onClick={onClose}>Oturumu kapat</Button> : null}
  </form>;
  if (required) return <main className="flex min-h-screen items-center justify-center bg-canvas p-6"><div className="w-full max-w-md"><Card><h1 className="mb-4 font-display text-2xl font-bold text-ink">Şifrenizi değiştirin</h1>{form}</Card></div></main>;
  return <Drawer open title="Şifremi değiştir" onClose={() => { if (!busy) onClose(); }}>{form}</Drawer>;
}
