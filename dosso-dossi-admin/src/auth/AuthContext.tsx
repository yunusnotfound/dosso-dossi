import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, SESSION_KEY, setSessionLostHandler, tokens } from '../api/client';
import type { AdminProfile, LoginResponse } from '../api/types';

interface AuthState {
  admin: AdminProfile | null;
  loading: boolean;
  sessionKey: string;
  notice: string;
  login: (email: string, password: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionKey, setSessionKey] = useState(tokens.session);
  const [notice, setNotice] = useState('');
  const attempt = useRef(0);
  const drop = useCallback((message: string) => {
    attempt.current++;
    setAdmin(null);
    setLoading(false);
    setSessionKey(crypto.randomUUID());
    setNotice(message);
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => drop('Oturumunuz sona erdi veya yönetici tarafından kapatıldı. Yeniden giriş yapın.'));
    return () => setSessionLostHandler(() => {});
  }, [drop]);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const current = ++attempt.current;
      setAdmin(null);
      setSessionKey(tokens.session);
      setLoading(true);
      try {
        if (!tokens.access) return;
        const me = await api<AdminProfile>('/admin/auth/me');
        if (!cancelled && current === attempt.current) setAdmin(me);
      } catch (error) {
        if (!cancelled && current === attempt.current) {
          // Temporary connection failures do not destroy a valid stored session.
          setNotice(error instanceof ApiError ? error.message : 'Oturum doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin.');
        }
      } finally {
        if (!cancelled && current === attempt.current) setLoading(false);
      }
    };
    void restore();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY || e.key === null || (e.key === 'dd_admin_access' && e.newValue === null)) {
        setNotice('Oturum başka bir sekmede değiştirildi.');
        void restore();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { cancelled = true; window.removeEventListener('storage', onStorage); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const current = ++attempt.current;
    const res = await api<LoginResponse>('/admin/auth/login', {
      method: 'POST', anonymous: true,
      body: { email, password, deviceInfo: navigator.userAgent.slice(0, 120) },
    });
    if (current !== attempt.current) throw new ApiError('SESSION_CHANGED', 401, 'Oturum değişti. Yeniden giriş yapın.');
    tokens.replace(res.token, res.refreshToken);
    setSessionKey(tokens.session);
    setNotice('');
    setAdmin(res.admin);
    setLoading(false);
  }, []);

  const logout = useCallback(async (message = 'Bu cihazdaki oturum kapatıldı.') => {
    const refreshToken = tokens.refresh;
    tokens.clear();
    drop(message);
    const current = attempt.current;
    if (refreshToken) {
      try {
        await api('/admin/auth/logout', { method: 'POST', anonymous: true, body: { refreshToken } });
      } catch {
        if (current === attempt.current) setNotice('Bu cihazdan çıkış yapıldı. Sunucuya ulaşılamadığı için uzaktaki oturum iptali doğrulanamadı.');
      }
    }
  }, [drop]);
  const value = useMemo(() => ({ admin, loading, sessionKey, notice, login, logout }), [admin, loading, sessionKey, notice, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
