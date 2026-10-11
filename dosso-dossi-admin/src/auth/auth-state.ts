import { createContext, useContext } from 'react';
import type { AdminProfile } from '../api/types';

export interface AuthState {
  admin: AdminProfile | null;
  loading: boolean;
  sessionKey: string;
  notice: string;
  login: (email: string, password: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
