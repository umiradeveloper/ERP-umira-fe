'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, session, type Session, type SessionUser } from './api';

interface AuthCtx {
  user: SessionUser | null;
  ready: boolean;
  login: (tenant: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setUser(session.get()?.user ?? null);
    sync();
    setReady(true);
    window.addEventListener('erp-session', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('erp-session', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const login = useCallback(async (tenant: string, email: string, password: string) => {
    const s = await api<Session>('/auth/login', { body: { tenant, email, password } });
    session.set(s);
  }, []);

  const logout = useCallback(async () => {
    const s = session.get();
    if (s) await api('/auth/logout', { body: { refreshToken: s.refreshToken } }).catch(() => {});
    session.set(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
