'use client';

import { pct, rupiahShort } from '@/lib/format';
import { cn } from './ui';

/** BK/PU = Biaya Konstruksi ÷ Pendapatan Usaha. Oranye bila lebih buruk dari pembanding, merah di atas 100%. */
export function BkPu({ pct: v, bk, pu, base, empty, align = 'right' }: { pct: number | null | undefined; bk?: any; pu?: any; base?: number | null; empty: string; align?: 'right' | 'left' }) {
  if (v === null || v === undefined) return <span className="text-xs text-muted">{empty}</span>;
  const worse = base !== undefined && base !== null && v > base + 0.005;
  const over = v > 100;
  return (
    <div className={cn('inline-block', align === 'right' ? 'text-right' : 'text-left')} title={bk !== undefined ? `BK ${rupiahShort(bk)} ÷ PU ${rupiahShort(pu)}` : undefined}>
      <div className={cn('num font-semibold', over ? 'text-bad' : worse ? 'text-warn' : '')}>{pct(v, 2)}</div>
      {bk !== undefined && <div className="num mt-0.5 text-xs text-muted">{rupiahShort(bk)} / {rupiahShort(pu)}</div>}
    </div>
  );
}

/** Efisiensi = BK/PU awal − BK/PU saat ini (poin persen). Positif = lebih hemat dari rencana awal. */
export function Efisiensi({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return <span className={cn('text-xs text-muted', className)}>—</span>;
  const tone = value > 0.005 ? 'text-ok' : value < -0.005 ? 'text-bad' : 'text-ink';
  const sign = value > 0.005 ? '+' : '';
  return <span className={cn('num font-semibold', tone, className)}>{sign}{value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} poin</span>;
}

/** BK/PU penetapan (input manual) */
export function Penetapan({ value }: { value: any }) {
  if (value === null || value === undefined || value === '') return <span className="text-xs text-muted">Belum ditetapkan</span>;
  return <span className="num font-semibold">{pct(Number(value), 2)}</span>;
}
