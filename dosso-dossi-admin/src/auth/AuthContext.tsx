import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setSessionLostHandler, tokens } from '../api/client';
import type { AdminProfile, LoginResponse } from '../api/types';

interface AuthState {
  admin: AdminProfile | null;
  /// İlk açılışta saklı token doğrulanana kadar true.
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh de reddedilirse oturumu düşür: kullanıcı boş ekranda kalmasın.
  useEffect(() => {
    setSessionLostHandler(() => setAdmin(null));
  }, []);

  // Sayfa yenilenince saklı token'la profili geri al.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokens.access) {
        setLoading(false);
        return;
      }
      try {
        const me = await api<AdminProfile>('/admin/auth/me');
        if (!cancelled) setAdmin(me);
      } catch {
        tokens.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>('/admin/auth/login', {
      method: 'POST',
      anonymous: true,
      body: { email, password, deviceInfo: navigator.userAgent.slice(0, 120) },
    });
    tokens.set(res.token, res.refreshToken);
    setAdmin(res.admin);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokens.refresh;
    if (refreshToken) {
      // Çıkış her hâlükârda başarılı sayılır; sunucu hatası kullanıcıyı tutmasın.
      await api('/admin/auth/logout', {
        method: 'POST',
        anonymous: true,
        body: { refreshToken },
      }).catch(() => undefined);
    }
    tokens.clear();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({ admin, loading, login, logout }),
    [admin, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
