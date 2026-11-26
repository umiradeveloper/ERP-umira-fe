import { cn } from './ui';
import { pct, rupiahShort, toNum } from '@/lib/format';

/** Angka ringkas berlabel (lebih kecil dari Stat agar nilai Rupiah panjang tidak terpotong) */
export function Fig({ label, value, sub, tone, hint }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad'; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn('num mt-1 text-lg font-semibold tracking-[-0.01em]', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn', tone === 'ok' && 'text-ok')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** Perbandingan % biaya terpakai dengan % progres fisik */
export function CostVsProgress({ used, progress, compact }: { used: number; progress: number; compact?: boolean }) {
  const ahead = used - progress;
  const tone = ahead > 10 ? 'text-bad' : ahead > 3 ? 'text-warn' : 'text-ok';
  return (
    <div>
      <div className="relative h-2 rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-ink/80" style={{ width: `${Math.min(progress, 100)}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-signal" style={{ left: `${Math.min(used, 100)}%` }} title={`Biaya terpakai ${pct(used, 1)}`} />
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className="text-muted">fisik {pct(progress, 1)} · biaya {pct(used, 1)}</span>
        {!compact && <span className={tone}>{ahead > 0 ? '+' : ''}{pct(ahead, 1)}</span>}
      </div>
    </div>
  );
}

export function cpiTone(cpi: number | null | undefined) {
  if (cpi === null || cpi === undefined) return 'text-muted';
  return cpi < 0.9 ? 'text-bad' : cpi < 1 ? 'text-warn' : 'text-ok';
}
export const money = (v: unknown) => rupiahShort(toNum(v as any));

export function CostLegend() {
  return (
    <div className="flex flex-wrap gap-5 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-ink" /> Actual</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-ink/30" /> Commitment</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-line" /> Sisa budget</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-signal" /> Biaya terpakai vs progres fisik</span>
    </div>
  );
}

export function CostTerms() {
  const T: [string, string][] = [
    ['Budget (RAP)', 'Budget pelaksanaan yang ditetapkan dari RAP.'],
    ['Commitment', 'PO disetujui/terbit yang belum ditagih supplier.'],
    ['Actual', 'Biaya diakui dari invoice supplier yang sudah diposting.'],
    ['EAC', 'Estimate at completion: actual + commitment + sisa budget.'],
    ['Varian', 'Budget − EAC. Negatif = diperkirakan melebihi budget.'],
    ['Forecast margin', 'Nilai kontrak (RAB) − EAC.'],
    ['CPI', 'Earned value (budget × progres fisik) ÷ actual. Di bawah 1 = biaya lebih boros dari progres.'],
    ['Biaya vs progres', '% biaya terpakai dibanding % progres fisik. Positif = biaya mendahului pekerjaan.'],
  ];
  return (
    <details className="rounded-xl border border-line bg-surface px-5 py-4 text-sm">
      <summary className="cursor-pointer font-medium">Arti istilah cost control</summary>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {T.map(([t, d]) => (<div key={t}><dt className="font-semibold">{t}</dt><dd className="mt-0.5 text-muted">{d}</dd></div>))}
      </dl>
    </details>
  );
}
