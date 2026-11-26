'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CostLegend, CostTerms, CostVsProgress, cpiTone, Fig, money } from '@/components/cost-ui';
import { ExportButton } from '@/components/export-button';
import { Badge, BudgetBar, cn, Empty, ErrorBox, Input, Loading, PageHeader, Panel, Table, Td, Th, Tr } from '@/components/ui';
import { useApi } from '@/lib/api';
import { CATEGORY_LABEL, pct, toNum } from '@/lib/format';

type Alert = '' | 'OK' | 'WARNING' | 'OVER';
type Sort = 'used' | 'variance' | 'cpi' | 'budget' | 'name';

export default function CostPage() {
  const { data, error, loading, reload } = useApi<any[]>('/reports/cost-control');
  const [alert, setAlert] = useState<Alert>('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('used');

  const all = useMemo(() => (data ?? []).filter((p) => toNum(p.cost.budget) > 0 || toNum(p.cost.actual) > 0 || toNum(p.cost.commitment) > 0), [data]);
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    const xs = all.filter((p) => (!alert || p.cost.alert === alert) && (!status || p.status === status) && (!k || `${p.code} ${p.name}`.toLowerCase().includes(k)));
    const by: Record<Sort, (a: any, b: any) => number> = {
      used: (a, b) => toNum(b.cost.usedPct) - toNum(a.cost.usedPct),
      variance: (a, b) => toNum(a.cost.variance) - toNum(b.cost.variance),
      cpi: (a, b) => (a.cpi ?? 99) - (b.cpi ?? 99),
      budget: (a, b) => toNum(b.cost.budget) - toNum(a.cost.budget),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...xs].sort(by[sort]);
  }, [all, alert, status, q, sort]);

  const sum = (k: string) => rows.reduce((a, p) => a + toNum(p.cost[k]), 0);
  const tot = { budget: sum('budget'), commitment: sum('commitment'), actual: sum('actual'), eac: sum('eac'), variance: sum('variance') };
  const contract = rows.reduce((a, p) => a + toNum(p.contractValue), 0);
  const margin = rows.reduce((a, p) => a + (p.forecastMargin === null ? 0 : toNum(p.forecastMargin)), 0);
  const used = tot.budget ? ((tot.actual + tot.commitment) / tot.budget) * 100 : 0;
  const ev = rows.reduce((a, p) => a + toNum(p.earnedValue), 0);
  const cpi = tot.actual > 0 && ev > 0 ? ev / tot.actual : null;
  const count = (a: string) => all.filter((p) => p.cost.alert === a).length;

  // matriks per kategori (gabungan proyek terfilter)
  const cats = useMemo(() => {
    const m = new Map<string, { budget: number; commitment: number; actual: number; eac: number; variance: number }>();
    for (const p of rows) for (const c of p.categories ?? []) {
      const e = m.get(c.category) ?? { budget: 0, commitment: 0, actual: 0, eac: 0, variance: 0 };
      for (const k of ['budget', 'commitment', 'actual', 'eac', 'variance'] as const) e[k] += toNum(c[k]);
      m.set(c.category, e);
    }
    return [...m.entries()].filter(([, v]) => v.budget || v.actual || v.commitment).map(([category, v]) => ({ category, ...v, used: v.budget ? ((v.actual + v.commitment) / v.budget) * 100 : v.actual + v.commitment ? 100 : 0 }));
  }, [rows]);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="Cost control"
        description="Kontrol semua biaya proyek: budget RAP, commitment PO, actual invoice, forecast (EAC) dan perbandingannya dengan progres fisik."
        actions={<ExportButton path="/exports/cost-control.xlsx" />}
      />
      <ErrorBox error={error} onRetry={reload} />

      {loading && !data ? <Loading /> : (
        <>
          <Panel>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <Fig label="Nilai kontrak" value={money(contract)} sub={`${rows.length} proyek`} />
              <Fig label="Budget RAP" value={money(tot.budget)} sub={contract ? `${pct((tot.budget / contract) * 100, 1)} dari kontrak` : undefined} />
              <Fig label="Commitment" value={money(tot.commitment)} sub="PO belum ditagih" />
              <Fig label="Actual" value={money(tot.actual)} sub="invoice diposting" />
              <Fig label="EAC" value={money(tot.eac)} sub={`terpakai ${pct(used, 1)}`} tone={used >= 100 ? 'bad' : used >= 80 ? 'warn' : undefined} />
              <Fig label="Varian" value={money(tot.variance)} tone={tot.variance < 0 ? 'bad' : 'ok'} sub="budget − EAC" />
              <Fig label="Forecast margin" value={money(margin)} tone={margin < 0 ? 'bad' : 'ok'} sub={contract ? `${pct((margin / contract) * 100, 1)} dari kontrak` : undefined} />
              <Fig label="CPI portofolio" value={cpi === null ? '—' : cpi.toFixed(2)} tone={cpi === null ? undefined : cpi < 0.9 ? 'bad' : cpi < 1 ? 'warn' : 'ok'} sub="EV ÷ actual" />
            </div>
            <div className="mt-5"><BudgetBar budget={tot.budget} actual={tot.actual} commitment={tot.commitment} /></div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel title="Biaya per kategori" subtitle="Gabungan proyek yang tampil di tabel" bodyClass="p-0">
              {!cats.length ? <Empty title="Belum ada biaya" /> : (
                <Table>
                  <thead><tr><Th>Kategori</Th><Th right>Budget</Th><Th right>Commitment</Th><Th right>Actual</Th><Th right>EAC</Th><Th right>Varian</Th><Th className="w-44">Pemakaian</Th></tr></thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr key={c.category} className="border-t border-line">
                        <Td className="font-medium">{CATEGORY_LABEL[c.category] ?? c.category}</Td>
                        <Td right>{money(c.budget)}</Td>
                        <Td right>{money(c.commitment)}</Td>
                        <Td right>{money(c.actual)}</Td>
                        <Td right className="font-medium">{money(c.eac)}</Td>
                        <Td right className={c.variance < 0 ? 'text-bad' : ''}>{money(c.variance)}</Td>
                        <Td><BudgetBar budget={c.budget} actual={c.actual} commitment={c.commitment} /><div className={cn('num mt-1 text-xs', c.used >= 100 ? 'text-bad' : c.used >= 80 ? 'text-warn' : 'text-muted')}>{pct(c.used, 0)}</div></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
            <Panel title="Status budget proyek">
              <div className="grid grid-cols-3 gap-3">
                {([['OK', 'Aman', 'text-ok'], ['WARNING', 'Waspada ≥80%', 'text-warn'], ['OVER', 'Lewat budget', 'text-bad']] as const).map(([v, l, c]) => (
                  <button key={v} type="button" onClick={() => setAlert(alert === v ? '' : v)}
                    className={cn('rounded-xl border px-3 py-3 text-left transition-colors', alert === v ? 'border-ink bg-ink/5' : 'border-line hover:border-ink/40')}>
                    <div className={cn('num text-2xl font-semibold', c)}>{count(v)}</div>
                    <div className="text-xs text-muted">{l}</div>
                  </button>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                <div className="text-xs font-medium text-muted">Biaya mendahului progres fisik (&gt;10 poin)</div>
                {all.filter((p) => p.costAheadPct > 10).slice(0, 5).map((p) => (
                  <a key={p.id} href={`/cost/${p.id}`} className="block rounded-lg border border-line px-3 py-2 hover:border-ink/40">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <CostVsProgress used={toNum(p.cost.usedPct)} progress={toNum(p.progressPct)} />
                  </a>
                ))}
                {!all.some((p) => p.costAheadPct > 10) && <p className="text-sm text-muted">Tidak ada — biaya sejalan dengan progres fisik.</p>}
              </div>
            </Panel>
          </div>

          <Panel
            title="Proyek"
            bodyClass="p-0"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari proyek" className="h-8 w-48 pl-8 text-[13px]" />
                </div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[13px]">
                  <option value="">Semua status</option><option value="ACTIVE">Berjalan</option><option value="SETUP">Setup</option><option value="ON_HOLD">Ditunda</option><option value="COMPLETION">Serah terima</option><option value="CLOSED">Ditutup</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[13px]">
                  <option value="used">Pemakaian tertinggi</option><option value="variance">Varian terburuk</option><option value="cpi">CPI terendah</option><option value="budget">Budget terbesar</option><option value="name">Nama</option>
                </select>
                {(alert || status || q) && <button type="button" className="text-[13px] text-ink-2 hover:underline" onClick={() => { setAlert(''); setStatus(''); setQ(''); }}>Reset</button>}
              </div>
            }
          >
            {!rows.length ? <Empty title={all.length ? 'Tidak ada proyek yang cocok' : 'Belum ada proyek dengan budget'} /> : (
              <Table minWidth={1050}>
                <thead>
                  <tr>
                    <Th>Proyek</Th><Th right>Budget RAP</Th><Th right>Commitment</Th><Th right>Actual</Th><Th right>EAC</Th>
                    <Th right>Varian</Th><Th right>Margin</Th><Th className="w-32">Pemakaian</Th><Th className="w-40">Biaya vs progres</Th><Th right>CPI</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <Tr key={p.id} href={`/cost/${p.id}`}>
                      <Td><div className="max-w-[220px] truncate font-medium">{p.name}</div><div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">{p.code} <Badge status={p.cost.alert} /></div></Td>
                      <Td right>{money(p.cost.budget)}</Td>
                      <Td right>{money(p.cost.commitment)}</Td>
                      <Td right>{money(p.cost.actual)}</Td>
                      <Td right className="font-medium">{money(p.cost.eac)}</Td>
                      <Td right className={toNum(p.cost.variance) < 0 ? 'text-bad' : ''}>{money(p.cost.variance)}</Td>
                      <Td right className={p.forecastMargin !== null && toNum(p.forecastMargin) < 0 ? 'text-bad' : ''}>
                        {p.forecastMargin === null ? '—' : money(p.forecastMargin)}
                        {p.forecastMarginPct !== null && <div className="text-xs text-muted">{pct(p.forecastMarginPct, 1)}</div>}
                      </Td>
                      <Td><BudgetBar budget={p.cost.budget} actual={p.cost.actual} commitment={p.cost.commitment} /><div className="num mt-1 text-xs text-muted">{pct(p.cost.usedPct, 0)}</div></Td>
                      <Td className="min-w-[150px]"><CostVsProgress compact used={toNum(p.cost.usedPct)} progress={toNum(p.progressPct)} /></Td>
                      <Td right className={cn('num font-medium', cpiTone(p.cpi))}>{p.cpi === null ? '—' : p.cpi.toFixed(2)}</Td>
                    </Tr>
                  ))}
                  <tr className="bg-hover font-semibold">
                    <Td>Total ({rows.length})</Td>
                    <Td right>{money(tot.budget)}</Td><Td right>{money(tot.commitment)}</Td><Td right>{money(tot.actual)}</Td>
                    <Td right>{money(tot.eac)}</Td><Td right className={tot.variance < 0 ? 'text-bad' : ''}>{money(tot.variance)}</Td><Td right>{money(margin)}</Td>
                    <Td colSpan={2}><BudgetBar budget={tot.budget} actual={tot.actual} commitment={tot.commitment} /></Td>
                    <Td right className={cpiTone(cpi)}>{cpi === null ? '—' : cpi.toFixed(2)}</Td>
                  </tr>
                </tbody>
              </Table>
            )}
          </Panel>
          <CostLegend />
          <CostTerms />
        </>
      )}
    </div>
  );
}
