import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/auth-state';
import { Button, Card } from '../../components/ui';

export function LoginPage() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      // Sunucu "e-posta veya şifre hatalı" diyor; hangisi olduğunu bilerek
      // ayırmıyoruz (hesap varlığı sızmasın).
      setError(
        err instanceof ApiError ? err.message : 'Giriş yapılamadı, tekrar deneyin',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <img src="/brand/dosso-dossi-logo.png" alt="Dosso Dossi Coffee" className="mx-auto mb-5 size-24 rounded-full bg-surface object-contain" />
          <p className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Dosso Dossi
          </p>
          <p className="mt-2 text-sm text-ink-muted">Yönetim Paneli</p>
        </div>

        <Card>
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">E-posta</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="admin-input"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Şifre</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
              />
            </label>

            {notice ? <p role="status" className="text-sm text-ink-muted">{notice}</p> : null}
            {error ? (
              <p
                role="alert"
                className="rounded-chip bg-bad-soft px-3 py-2 text-sm text-bad"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
