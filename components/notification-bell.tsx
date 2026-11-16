'use client';

import { AlertTriangle, Bell, CheckCircle2, Clock, Package, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from './ui';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';

const ICON: Record<string, any> = {
  APPROVAL_PENDING: Clock, APPROVAL_RESULT: CheckCircle2, BUDGET_ALERT: AlertTriangle, AR_OVERDUE: Wallet, AP_DUE: Wallet, LOW_STOCK: Package,
};
const TONE: Record<string, string> = { BUDGET_ALERT: 'text-bad', AR_OVERDUE: 'text-bad', AP_DUE: 'text-warn', LOW_STOCK: 'text-warn' };

/** Lonceng notifikasi in-app; polling ringan tiap 60 detik */
export function NotificationBell({ dark }: { dark?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: any[]; unread: number }>({ items: [], unread: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => api('/notifications').then(setData).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);

  async function go(n: any) {
    if (!n.readAt) await api(`/notifications/${n.id}/read`, { body: {} }).catch(() => {});
    setOpen(false);
    load();
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className={cn('relative rounded-lg p-2 transition-colors', dark ? 'text-side-text hover:bg-side-2 hover:text-white' : 'text-ink-2 hover:bg-hover')}
        aria-label={`Notifikasi${data.unread ? `, ${data.unread} belum dibaca` : ''}`}
        aria-expanded={open}
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {data.unread > 0 && (
          <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[10px] font-bold text-white">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className={cn('animate-rise absolute top-11 z-50', dark ? 'left-0' : 'right-0', ' w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-[0_20px_50px_-12px_rgba(27,36,32,0.35)]')}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifikasi</span>
            {data.unread > 0 && (
              <button className="text-xs font-medium text-muted hover:text-ink" onClick={() => api('/notifications/read-all', { body: {} }).then(load)}>
                Tandai semua dibaca
              </button>
            )}
          </div>
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Belum ada notifikasi.</li>}
            {data.items.map((n) => {
              const Icon = ICON[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => go(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-hover', !n.readAt && 'bg-signal-soft/40')}>
                    <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[n.type] ?? 'text-muted')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] leading-snug', !n.readAt ? 'font-semibold' : 'text-ink-2')}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-xs text-muted line-clamp-2">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-faint">{dateTime(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-signal" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
