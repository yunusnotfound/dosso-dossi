import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Coffee, Files, LayoutDashboard, LogOut, Megaphone, Menu, RadioTower, ReceiptText, Settings2, ShieldCheck, Store, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { ROLE_LABELS, type AdminRole } from '../api/types';
import { useAuth } from '../auth/auth-state';
import { ChangePassword } from '../features/auth/ChangePassword';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: 'Operasyon' | 'Müşteri & Finans' | 'Sistem';
  /// Menüyü görebilen roller. Boşsa herkes görür.
  roles?: AdminRole[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Genel bakış', icon: LayoutDashboard, group: 'Operasyon' },
  { to: '/siparisler', label: 'Siparişler', icon: ReceiptText, group: 'Operasyon' },
  { to: '/menu', label: 'Menü', icon: Coffee, group: 'Operasyon' },
  { to: '/subeler', label: 'Şubeler', icon: Store, group: 'Operasyon' },
  { to: '/kampanyalar', label: 'Kampanyalar', icon: Megaphone, group: 'Operasyon' },
  { to: '/musteriler', label: 'Müşteriler', icon: Users, group: 'Müşteri & Finans', roles: ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] },
  { to: '/hesap-talepleri', label: 'Hesap Talepleri', icon: Files, group: 'Müşteri & Finans', roles: ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] },
  { to: '/finans', label: 'Finans', icon: Wallet, group: 'Müşteri & Finans', roles: ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] },
  { to: '/pos', label: 'POS İzleme', icon: RadioTower, group: 'Sistem', roles: ['SUPER_ADMIN', 'MANAGER', 'VIEWER'] },
  // Yönetim yalnız süper yöneticide; audit ayrıca MANAGER'a da açık ama
  // sayfanın tamamı yönetici işlemleri içerdiği için burada kısıtlı.
  { to: '/yonetim', label: 'Yönetim', icon: Settings2, group: 'Sistem', roles: ['SUPER_ADMIN'] },
];

export function AppShell() {
  const { admin, logout } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const items = NAV.filter(
    (i) => !i.roles || (admin && i.roles.includes(admin.role)),
  );

  const currentPage = items.find((item) => item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to))?.label ?? 'Yönetim paneli';
  const initials = (admin?.email?.split('@')[0] || 'DD').slice(0, 2).toLocaleUpperCase('tr-TR');
  return (
    <div className="min-h-screen bg-canvas md:flex">
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-chip focus:bg-surface focus:p-3">İçeriğe geç</a>
      <aside className="admin-sidebar">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <img src="/brand/dosso-dossi-logo.png" alt="Dosso Dossi Coffee" className="size-11 rounded-full bg-surface object-contain" />
            <div><p className="font-display text-[15px] font-extrabold tracking-tight">Dosso Dossi</p><p className="mt-1 text-[10px] tracking-[0.18em] text-on-dark-muted">COFFEE · ADMIN</p></div>
          </div>
          <button type="button" className="rounded-chip p-2 text-on-dark md:hidden" aria-expanded={mobileMenuOpen} aria-controls="admin-sidebar-content" aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <div id="admin-sidebar-content" className={`${mobileMenuOpen ? 'flex' : 'hidden'} mt-8 min-h-0 flex-1 flex-col md:flex`}>
          <nav aria-label="Ana menü" className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-6">
            {(['Operasyon', 'Müşteri & Finans', 'Sistem'] as const).map((group) => {
              const groupItems = items.filter((item) => item.group === group);
              return groupItems.length ? <div key={group}>
                <p className="admin-section-label mb-2">{group}</p>
                <div className="space-y-1">{groupItems.map(({ icon: Icon, ...item }) => <NavLink key={item.to} to={item.to} end={item.to === '/'} className="admin-navigation-link" onClick={() => setMobileMenuOpen(false)}>
                  <Icon size={18} strokeWidth={1.65} aria-hidden="true" />{item.label}
                </NavLink>)}</div>
              </div> : null;
            })}
          </nav>
          <div className="border-t border-coffee-line px-2 pt-5">
            <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full border border-coffee-line bg-coffee-raised text-xs font-semibold">{initials}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{admin?.email}</p><p className="mt-1 text-[11px] text-on-dark-muted">{admin ? ROLE_LABELS[admin.role] : ''}</p></div></div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button onClick={() => setPasswordOpen(true)} className="text-[11px] text-on-dark-muted hover:text-on-dark">Şifremi değiştir</button><button onClick={() => void logout()} className="flex items-center gap-1.5 text-[11px] font-medium text-brand-light hover:text-on-dark"><LogOut size={13} aria-hidden="true" />Çıkış yap</button></div>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4 sm:px-7 xl:px-8">
          <p className="flex items-center gap-3 text-xs text-ink-muted"><span>Yönetim paneli</span><span aria-hidden="true">/</span><span className="font-medium text-ink">{currentPage}</span></p>
          <span className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex"><ShieldCheck size={15} aria-hidden="true" />{admin ? ROLE_LABELS[admin.role] : ''}</span>
        </header>
        <main id="admin-content" className="admin-page-content"><Outlet /></main>
      </div>
      {passwordOpen ? <ChangePassword onClose={() => setPasswordOpen(false)} /> : null}
    </div>
  );
}
