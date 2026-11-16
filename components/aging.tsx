'use client';

import { rupiahShort, toNum } from '@/lib/format';
import { cn } from './ui';

const B = [
  ['current', 'Belum jatuh tempo'],
  ['d1_30', '1–30 hari'],
  ['d31_60', '31–60 hari'],
  ['d61_90', '61–90 hari'],
  ['d90p', '> 90 hari'],
] as const;

/** Ringkasan umur piutang/hutang sebagai satu bar bertumpuk */
export function AgingStrip({ data, title }: { data: any; title: string }) {
  if (!data) return null;
  const total = toNum(data.total) || 1;
  const colors = ['bg-ok', 'bg-signal', 'bg-warn', 'bg-bad/70', 'bg-bad'];
  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="num text-xl font-semibold">{rupiahShort(data.total)}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
        {B.map(([k], i) => (
          <div key={k} className={cn(colors[i])} style={{ width: `${(toNum(data.buckets[k]) / total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {B.map(([k, l], i) => (
          <div key={k}>
            <dt className="flex items-center gap-1.5 text-xs text-muted"><span className={cn('size-2 rounded-sm', colors[i])} />{l}</dt>
            <dd className="num mt-0.5 text-sm font-semibold">{rupiahShort(data.buckets[k])}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
