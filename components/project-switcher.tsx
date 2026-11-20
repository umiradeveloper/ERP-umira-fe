'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import { pct } from '@/lib/format';
import { ProjectPhoto } from './project-photo';
import { Badge, cn } from './ui';

/** Daftar proyek di samping halaman detail untuk berpindah proyek dengan cepat */
export function ProjectSwitcher({ activeId }: { activeId: string }) {
  const { data, loading } = useApi<any[]>('/projects');
  const [q, setQ] = useState('');
  const rows = (data ?? []).filter((p) => !q || `${p.code} ${p.name} ${p.ownerName ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside className="hidden w-72 shrink-0 xl:block">
      <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[13px] font-semibold">Daftar proyek</span>
            <span className="num text-xs text-muted">{data?.length ?? 0}</span>
          </div>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-line-strong px-2.5 focus-within:border-ink">
            <Search className="size-3.5 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari proyek…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint" />
          </label>
        </div>
        <nav className="flex-1 overflow-y-auto p-1.5">
          {loading && !data && <div className="px-3 py-4 text-xs text-muted">Memuat…</div>}
          {data && rows.length === 0 && <div className="px-3 py-4 text-xs text-muted">Tidak ada proyek</div>}
          {rows.map((p) => {
            const active = p.id === activeId;
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors', active ? 'bg-ink text-white' : 'hover:bg-hover')}>
                <ProjectPhoto fileId={p.coverFileId} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[13px] font-medium', active ? 'text-white' : 'text-ink')}>{p.name}</div>
                  <div className={cn('mt-0.5 flex items-center gap-1.5 text-[11px]', active ? 'text-white/70' : 'text-muted')}>
                    <span className="num">{p.code}</span>
                    {p.bkpuSaatIniPct !== null && p.bkpuSaatIniPct !== undefined && <span className="num">· BK/PU {pct(p.bkpuSaatIniPct, 1)}</span>}
                  </div>
                </div>
                {!active && p.status !== 'ACTIVE' && <Badge status={p.status} />}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
