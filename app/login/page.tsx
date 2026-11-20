'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { Logo } from '@/components/logo';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [tenant, setTenant] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cfg, setCfg] = useState<{ tenant: string | null; superapps: boolean } | null>(null);

  useEffect(() => {
    api<{ tenant: string | null; superapps: boolean }>('/auth/config')
      .then((c) => setCfg(c))
      .catch(() => setCfg({ tenant: null, superapps: false }));
  }, []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(tenant, email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-semibold tracking-[-0.02em]">ERP Umira</span>
        </div>

        <div className="mx-auto w-full max-w-sm py-12">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Masuk ke ruang kerja</h1>
          <p className="mt-2 text-sm text-muted">Tender, proyek, pembelian dan keuangan perusahaan Anda dalam satu tempat.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {cfg && !cfg.tenant && (
              <Field label="Kode perusahaan">
                <Input value={tenant} onChange={(e) => setTenant(e.target.value)} autoComplete="organization" required />
              </Field>
            )}
            <Field label="Email atau username" hint={cfg?.superapps ? 'Gunakan akun SuperApps Anda' : undefined}>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </Field>
            {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Masuk
            </Button>
          </form>

        </div>

        <p className="text-xs text-faint">© {new Date().getFullYear()} Umira · Construction, Development, Investment</p>
      </section>

      <aside className="relative hidden overflow-hidden bg-side lg:block">
        {/* Grid cetak biru */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0v40" fill="none" stroke="#fff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>
        <div className="relative flex h-full flex-col justify-end p-16 text-white">
          <div className="max-w-md">
            <div className="mb-8 space-y-4">
              {[
                ['Gedung Kantor 4 Lantai', 60, 64],
                ['Gudang Logistik Cikarang', 44, 46],
                ['Perumahan Griya Asri', 8, 10],
              ].map(([n, a, p]) => (
                <div key={n as string}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-side-text">{n}</span>
                    <span className="num font-medium">{a}%</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/10">
                    <div className="animate-grow absolute inset-y-0 left-0 rounded-full bg-signal" style={{ width: `${a}%` }} />
                    <div className="absolute -top-1 h-4 w-0.5 rounded bg-white" style={{ left: `${p}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-2xl font-medium leading-snug tracking-[-0.01em]">
              Dari penawaran sampai serah terima, setiap rupiah tercatat terhadap budget proyeknya.
            </p>
            <p className="mt-3 text-sm text-side-text">Bar tembaga: progres aktual. Garis putih: rencana.</p>
          </div>
        </div>
      </aside>
    </main>
  );
}
