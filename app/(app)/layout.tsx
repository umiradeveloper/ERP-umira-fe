'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3, BookOpen, Building2, CheckSquare, ClipboardList, FileSignature, FileText, HardHat,
  LayoutDashboard, LogOut, Menu, Receipt, Scale, Warehouse, ScrollText, Settings2, ShoppingCart, Truck, Users, Wallet, X,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { NotificationBell } from '@/components/notification-bell';
import { cn, Loading } from '@/components/ui';
import { api, can } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type NavItem = { href: string; label: string; icon: any; perm?: string; badge?: 'approvals' };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: '',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/approvals', label: 'Approval saya', icon: CheckSquare, badge: 'approvals' },
    ],
  },
  {
    group: 'Komersial & proyek',
    items: [
      { href: '/tenders', label: 'Tender & BQ', icon: FileSignature, perm: 'tender:read' },
      { href: '/projects', label: 'Proyek', icon: HardHat, perm: 'project:read' },
      { href: '/cost', label: 'Cost control', icon: BarChart3, perm: 'cost:read' },
    ],
  },
  {
    group: 'Pengadaan',
    items: [
      { href: '/procurement/pr', label: 'Purchase request', icon: ClipboardList, perm: 'procurement:read' },
      { href: '/procurement/rfq', label: 'RFQ & penawaran', icon: Scale, perm: 'procurement:read' },
      { href: '/procurement/po', label: 'Purchase order', icon: ShoppingCart, perm: 'procurement:read' },
    ],
  },
  {
    group: 'Keuangan',
    items: [
      { href: '/finance/invoices', label: 'Penagihan & piutang', icon: Receipt, perm: 'finance:read' },
      { href: '/finance/ap', label: 'Hutang supplier', icon: Wallet, perm: 'finance:read' },
      { href: '/accounting/journals', label: 'Jurnal', icon: BookOpen, perm: 'accounting:read' },
      { href: '/accounting/reports', label: 'Laporan keuangan', icon: FileText, perm: 'accounting:read' },
    ],
  },
  {
    group: 'Aset & gudang',
    items: [
      { href: '/assets', label: 'Aset & alat', icon: Truck, perm: 'asset:read' },
      { href: '/inventory', label: 'Gudang & stok', icon: Warehouse, perm: 'warehouse:read' },
    ],
  },
  {
    group: 'Pengaturan',
    items: [
      { href: '/master', label: 'Customer & supplier', icon: Building2, perm: 'master:read' },
      { href: '/admin/users', label: 'User & role', icon: Users, perm: 'admin:read' },
      { href: '/admin/workflows', label: 'Alur approval', icon: Settings2, perm: 'admin:read' },
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText, perm: 'audit:read' },
    ],
  },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    api<any[]>('/approvals/inbox')
      .then((r) => setPending(r.filter((x) => x.canAct).length))
      .catch(() => {});
  }, [user, path]);

  useEffect(() => setOpen(false), [path]);

  if (!ready || !user) return <Loading label="Memeriksa sesi…" />;

  const initials = user.name.split(' ').map((s) => s[0]).slice(0, 2).join('');

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 py-5 pl-5 pr-3">
        <Logo className="size-7" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight text-white">ERP Umira</div>
          <div className="truncate text-xs text-side-text">{user.tenant.name}</div>
        </div>
        <NotificationBell dark />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-6" aria-label="Navigasi utama">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(user, i.perm));
          if (!items.length) return null;
          return (
            <div key={g.group || 'main'}>
              {g.group && <div className="mb-1 px-2 text-xs text-side-text/60">{g.group}</div>}
              <ul className="space-y-0.5">
                {items.map((i) => {
                  const active = path === i.href || path.startsWith(i.href + '/');
                  const Icon = i.icon;
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        className={cn(
                          'relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors',
                          active ? 'bg-side-2 font-medium text-white' : 'text-side-text hover:bg-side-2/60 hover:text-white',
                        )}
                      >
                        {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r bg-signal" />}
                        <Icon className={cn('size-4 shrink-0', active ? 'text-signal' : '')} strokeWidth={1.8} />
                        <span className="flex-1">{i.label}</span>
                        {i.badge === 'approvals' && pending > 0 && (
                          <span className="num rounded-md bg-signal px-1.5 text-xs font-semibold text-white">{pending}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-side-2 text-xs font-semibold text-white">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white">{user.name}</div>
            <div className="truncate text-xs text-side-text">{user.roles.join(', ')}</div>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="rounded-md p-1.5 text-side-text hover:bg-side-2 hover:text-white"
            title="Keluar"
            aria-label="Keluar"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-side lg:block">{sidebar}</aside>

      {/* Mobile */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <span className="font-semibold">ERP Umira</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-hover" aria-label="Buka menu">
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-side">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 p-1 text-side-text" aria-label="Tutup menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}

