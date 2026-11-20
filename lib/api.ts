'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const KEY = 'erp.session';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  title?: string | null;
  roles: string[];
  perms: string[];
  /** Menu yang boleh tampil; null = semua menu sesuai hak akses */
  menus?: string[] | null;
  tenant: { id: string; name: string; slug: string };
}
export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const session = {
  get(): Session | null {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  set(s: Session | null) {
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage tidak tersedia */
    }
    window.dispatchEvent(new Event('erp-session'));
  },
};

let refreshing: Promise<boolean> | null = null;

/** Ambil ulang sesi (hak akses & menu terbaru dari role) tanpa login ulang */
export function refreshSession() {
  return refresh();
}

async function refresh(): Promise<boolean> {
  const s = session.get();
  if (!s) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) return false;
      const { data } = await r.json();
      session.set(data);
      return true;
    })
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const s = session.get();
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...(s ? { authorization: `Bearer ${s.accessToken}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).catch(() => {
    throw new ApiError(0, 'NETWORK', 'Server API tidak dapat dihubungi. Pastikan API berjalan di ' + BASE);
  });

  if (res.status === 401 && retry && s && !path.startsWith('/auth/')) {
    if (await refresh()) return api<T>(path, opts, false);
    session.set(null);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error ?? {};
    const details = Array.isArray(e.details) ? `: ${e.details.join(', ')}` : '';
    throw new ApiError(res.status, e.code ?? 'ERROR', (e.message ?? 'Permintaan gagal') + details, e.details);
  }
  return json.data as T;
}

/** Hook data sederhana dengan reload manual */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (id === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e as ApiError);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function can(user: SessionUser | null | undefined, perm: string) {
  if (!user) return false;
  if (user.perms.includes('*') || user.perms.includes(perm)) return true;
  const [m, a] = perm.split(':');
  return a === 'read' && user.perms.includes(`${m}:write`);
}

async function rawFetch(path: string, init: RequestInit, retry = true): Promise<Response> {
  const s = session.get();
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), ...(s ? { authorization: `Bearer ${s.accessToken}` } : {}) } }).catch(() => {
    throw new ApiError(0, 'NETWORK', 'Server API tidak dapat dihubungi');
  });
  if (res.status === 401 && retry && s) {
    if (await refresh()) return rawFetch(path, init, false);
    session.set(null);
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Permintaan gagal');
  }
  return res;
}

/** Upload file (multipart) */
export async function apiUpload<T = any>(path: string, form: FormData): Promise<T> {
  const res = await rawFetch(path, { method: 'POST', body: form });
  return (await res.json()).data as T;
}

/** Ambil file sebagai Blob (untuk pratinjau gambar/PDF) */
export async function apiBlob(path: string): Promise<Blob> {
  return (await rawFetch(path, { method: 'GET' })).blob();
}

/** Unduh file dari API dengan header auth, lalu simpan via browser */
export async function apiDownload(path: string, fallbackName = 'download') {
  const res = await rawFetch(path, { method: 'GET' });
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1] ?? m[2]) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
