'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { toNum } from '@/lib/format';

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

// ───────── Button ─────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'signal';
const btn: Record<BtnVariant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2 disabled:bg-faint',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-hover disabled:text-faint',
  ghost: 'text-ink-2 hover:bg-black/5 disabled:text-faint',
  danger: 'bg-surface text-bad border border-bad/30 hover:bg-bad-soft',
  signal: 'bg-signal text-white hover:brightness-95 disabled:opacity-50',
};
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        btn[variant],
        className,
      )}
      {...p}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({ href, children, variant = 'secondary', icon, size = 'md' }: { href: string; children: ReactNode; variant?: BtnVariant; icon?: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2 rounded-lg font-medium transition-colors', size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm', btn[variant])}
    >
      {icon}
      {children}
    </Link>
  );
}

// ───────── Form ─────────
const field = 'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-signal/40 disabled:bg-canvas';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(field, 'h-10', p.type === 'number' && 'num text-right', className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn(field, 'h-10 pr-8', className)} {...p}>
      {children}
    </select>
  );
});
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, 'min-h-20 py-2', className)} {...p} />;
}
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// ───────── Layout ─────────
export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-[13px] text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, bodyClass, subtitle }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn('p-5', bodyClass)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn('num mt-1 truncate text-[22px] font-semibold tracking-[-0.02em]', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn', tone === 'ok' && 'text-ok')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ───────── Status badge ─────────
const STATUS: Record<string, [string, string]> = {
  DRAFT: ['Draft', 'neutral'],
  REVIEW: ['Review', 'info'],
  SUBMITTED: ['Diajukan', 'info'],
  IN_APPROVAL: ['Menunggu approval', 'warn'],
  APPROVED: ['Disetujui', 'ok'],
  REJECTED: ['Ditolak', 'bad'],
  REVISION: ['Perlu revisi', 'warn'],
  CONVERTED: ['Jadi PO', 'ok'],
  CANCELLED: ['Batal', 'neutral'],
  WON: ['Menang', 'ok'],
  LOST: ['Kalah', 'bad'],
  SETUP: ['Setup', 'info'],
  ACTIVE: ['Berjalan', 'ok'],
  ON_HOLD: ['Ditunda', 'warn'],
  COMPLETION: ['Serah terima', 'info'],
  CLOSED: ['Selesai', 'neutral'],
  ISSUED: ['Terbit', 'info'],
  PARTIAL_RECEIPT: ['Diterima sebagian', 'warn'],
  RECEIVED: ['Diterima', 'ok'],
  MATCHED: ['Cocok (3-way)', 'info'],
  MISMATCH: ['Tidak cocok', 'bad'],
  POSTED: ['Diposting', 'info'],
  PARTIAL_PAID: ['Dibayar sebagian', 'warn'],
  PAID: ['Lunas', 'ok'],
  OVERDUE: ['Jatuh tempo', 'bad'],
  REVERSED: ['Dibalik', 'neutral'],
  AVAILABLE: ['Tersedia', 'ok'],
  ASSIGNED: ['Di proyek', 'info'],
  IN_MAINTENANCE: ['Maintenance', 'warn'],
  RETIRED: ['Pensiun', 'neutral'],
  DISPOSED: ['Dilepas', 'neutral'],
  OPEN: ['Terbuka', 'ok'],
  OK: ['Aman', 'ok'],
  WARNING: ['≥ 80% budget', 'warn'],
  OVER: ['Lewat budget', 'bad'],
};
const TONE: Record<string, string> = {
  neutral: 'bg-canvas text-ink-2 ring-line-strong',
  info: 'bg-info-soft text-info ring-info/20',
  ok: 'bg-ok-soft text-ok ring-ok/20',
  warn: 'bg-warn-soft text-warn ring-warn/25',
  bad: 'bg-bad-soft text-bad ring-bad/20',
};
export function Badge({ status, label, tone }: { status?: string; label?: string; tone?: keyof typeof TONE }) {
  const [l, t] = status ? STATUS[status] ?? [status, 'neutral'] : [label ?? '', tone ?? 'neutral'];
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE[tone ?? t])}>{label ?? l}</span>;
}

// ───────── Table ─────────
export function Table({ children, className, minWidth }: { children: ReactNode; className?: string; minWidth?: number }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm" style={minWidth ? { minWidth } : undefined}>{children}</table>
    </div>
  );
}
export function Th({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <th className={cn('whitespace-nowrap border-b border-line bg-hover px-4 py-2.5 text-left text-xs font-medium text-muted first:pl-5 last:pr-5', right && 'text-right', className)}>{children}</th>;
}
export function Td({ children, className, right, colSpan }: { children?: ReactNode; className?: string; right?: boolean; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn('border-b border-line px-4 py-3 align-middle first:pl-5 last:pr-5', right && 'num whitespace-nowrap text-right', className)}>
      {children}
    </td>
  );
}
export function Tr({ children, href, onClick, className }: { children: ReactNode; href?: string; onClick?: () => void; className?: string }) {
  const router = useRouter();
  if (href) {
    return (
      <tr className={cn('group cursor-pointer transition-colors hover:bg-hover [&:last-child>td]:border-b-0', className)} onClick={() => router.push(href)}>
        {children}
      </tr>
    );
  }
  return <tr className={cn('[&:last-child>td]:border-b-0', onClick && 'cursor-pointer hover:bg-hover', className)} onClick={onClick}>{children}</tr>;
}

// ───────── Feedback ─────────
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 h-1.5 w-10 rounded-full bg-signal" />
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Loading({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}
export function ErrorBox({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-bad/25 bg-bad-soft px-5 py-4 text-sm text-bad">
      {error.message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 font-medium underline underline-offset-2">
          Coba lagi
        </button>
      )}
    </div>
  );
}

// ───────── Progress ─────────
/** Bar aktual (tembaga) dengan penanda rencana (garis teal) */
export function PlanBar({ actual, planned, className }: { actual: number | string; planned?: number | string; className?: string }) {
  const a = Math.min(100, Math.max(0, toNum(actual)));
  const p = planned !== undefined ? Math.min(100, Math.max(0, toNum(planned))) : undefined;
  return (
    <div className={cn('relative h-2 w-full rounded-full bg-line', className)}>
      <div className="animate-grow absolute inset-y-0 left-0 rounded-full bg-signal" style={{ width: `${a}%` }} />
      {p !== undefined && <div className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `calc(${p}% - 1px)` }} title={`Rencana ${p}%`} />}
    </div>
  );
}

/** Pemakaian budget: actual (grafit) + commitment (arsir) terhadap budget */
export function BudgetBar({ budget, actual, commitment }: { budget: any; actual: any; commitment: any }) {
  const b = toNum(budget) || 1;
  const a = (toNum(actual) / b) * 100;
  const c = (toNum(commitment) / b) * 100;
  const over = a + c > 100;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-line">
      <div className={cn('absolute inset-y-0 left-0', over ? 'bg-bad' : 'bg-ink')} style={{ width: `${Math.min(a, 100)}%` }} />
      <div
        className={cn('absolute inset-y-0', over ? 'bg-bad/40' : 'bg-ink/30')}
        style={{ left: `${Math.min(a, 100)}%`, width: `${Math.max(0, Math.min(c, 100 - Math.min(a, 100)))}%` }}
      />
    </div>
  );
}

// ───────── Modal ─────────
/**
 * Modal dirender ke document.body (portal) agar selalu menutupi seluruh layar —
 * tidak terkurung oleh elemen induk yang memakai transform/animasi.
 */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    // Kunci scroll halaman di belakang modal
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="flex min-h-full items-start justify-center p-4 pt-[8vh] pb-10">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn('animate-rise w-full rounded-2xl bg-surface shadow-[0_24px_60px_-12px_rgba(27,36,32,0.35)]', wide ? 'max-w-4xl' : 'max-w-lg')}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h3 className="text-base font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-hover hover:text-ink" aria-label="Tutup">
              <X className="size-4" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-line bg-hover px-6 py-3.5">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ───────── Tabs ─────────
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn(
            '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
            value === i.value ? 'border-signal font-semibold text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {i.label}
          {i.count !== undefined && <span className="num rounded bg-canvas px-1.5 text-xs text-muted">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KV({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: number }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', cols === 3 ? 'sm:grid-cols-3' : cols === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-ink">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
