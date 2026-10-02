import { useState } from 'react';
import { api } from '../api/client';
import { Drawer, Field, Input } from '../components/form';
import { Button } from '../components/ui';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS, type AdminRole } from '../api/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  /// Menüyü görebilen roller. Boşsa herkes görür.
  roles?: AdminRole[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Panel', icon: '◧' },
  { to: '/siparisler', label: 'Siparişler', icon: '☕' },
  { to: '/menu', label: 'Menü', icon: '≡' },
  { to: '/subeler', label: 'Şubeler', icon: '⌂' },
  { to: '/kampanyalar', label: 'Kampanyalar', icon: '◈' },
  { to: '/musteriler', label: 'Müşteriler', icon: '☺', roles: ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] },
  { to: '/finans', label: 'Finans', icon: '₺', roles: ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] },
  { to: '/pos', label: 'POS İzleme', icon: '⇄', roles: ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] },
  // Yönetim yalnız süper yöneticide; audit ayrıca MANAGER'a da açık ama
  // sayfanın tamamı yönetici işlemleri içerdiği için burada kısıtlı.
  { to: '/yonetim', label: 'Yönetim', icon: '⚙', roles: ['SUPER_ADMIN'] },
];

export function AppShell() {
  const { admin, logout } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const items = NAV.filter(
    (i) => !i.roles || (admin && i.roles.includes(admin.role)),
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-coffee p-4">
        <div className="px-2 py-3">
          <p className="font-[family-name:--font-display] text-lg font-extrabold text-on-dark">
            Dosso Dossi
          </p>
          <p className="text-xs text-on-dark-muted">Yönetim Paneli</p>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[--radius-pill] px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-on-dark-muted hover:bg-white/10 hover:text-on-dark'
                }`
              }
            >
              <span aria-hidden="true" className="w-4 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="rounded-[--radius-card] bg-white/5 p-3">
          <p className="truncate text-sm font-semibold text-on-dark">{admin?.email}</p>
          <p className="text-xs text-on-dark-muted">
            {admin ? ROLE_LABELS[admin.role] : ''}
          </p>
          <button onClick={() => setPasswordOpen(true)} className="mt-2 block text-xs font-semibold text-on-dark-muted hover:underline">Şifremi değiştir</button>
          <button
            onClick={() => void logout()}
            className="mt-2 text-xs font-semibold text-brand-light hover:underline"
          >
            Çıkış yap
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
      {passwordOpen ? <ChangePassword onClose={() => setPasswordOpen(false)} /> : null}
    </div>
  );
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Drawer open title="Şifremi değiştir" onClose={onClose}>
    <form className="flex flex-col gap-4" onSubmit={async (e) => {
      e.preventDefault();
      if (newPassword !== confirmation) { setError('Yeni şifreler eşleşmiyor.'); return; }
      setBusy(true); setError('');
      try {
        await api('/admin/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
        await logout('Şifreniz değiştirildi ve mevcut oturumlarınız kapatıldı. Yeni şifrenizle giriş yapın.');
      } catch (err) { setError(err instanceof Error ? err.message : 'Şifre değiştirilemedi'); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm text-ink-muted">Değişiklik kaydedilince açık oturumlarınız kapatılır. Yeni şifrenizle yeniden giriş yapın.</p>
      <Field label="Mevcut şifre"><Input type="password" autoComplete="current-password" required maxLength={200} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field>
      <Field label="Yeni şifre" hint="En az 12 karakter."><Input type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
      <Field label="Yeni şifre (tekrar)"><Input type="password" autoComplete="new-password" required minLength={12} maxLength={200} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></Field>
      {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
      <Button type="submit" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Şifreyi değiştir ve çıkış yap'}</Button>
    </form>
  </Drawer>;
}
