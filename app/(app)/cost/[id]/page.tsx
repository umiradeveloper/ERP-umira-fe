'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { use, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CostLegend, CostTerms, CostVsProgress, cpiTone, Fig, money } from '@/components/cost-ui';
import { Badge, BudgetBar, cn, Empty, ErrorBox, Input, Loading, PageHeader, Panel, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { useApi } from '@/lib/api';
import { CATEGORY_LABEL, date, num, pct, rupiah, toNum } from '@/lib/format';

type Tab = 'actual' | 'commitment';

export default function CostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: d, error, loading, reload } = useApi<any>(`/reports/cost-control/${id}`);
  const [tab, setTab] = useState<Tab>('actual');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');

  const costs = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (d?.costs ?? []).filter((c: any) => (!cat || c.category === cat) && (!k || [c.description, c.invoiceNumber, c.poNumber, c.supplier, c.supplierRef].filter(Boolean).join(' ').toLowerCase().includes(k)));
  }, [d, cat, q]);
  const commits = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (d?.commitments ?? []).filter((c: any) => (!cat || c.category === cat) && (!k || [c.description, c.poNumber, c.supplier].join(' ').toLowerCase().includes(k)));
  }, [d, cat, q]);

  if (loading && !d) return <Loading />;
  if (!d) return <ErrorBox error={error} onRetry={reload} />;

  const p = d.project;
  const t = d.summary.total;
  const rows = d.summary.rows.filter((r: any) => toNum(r.budget) || toNum(r.actual) || toNum(r.commitment));
  const pu = toNum(p.rabTotal) || toNum(p.contractValue);
  const chart = d.trend.map((x: any) => ({ m: x.month, actual: toNum(x.cumulative) }));
  const usedCats = [...new Set<string>([...(d.costs ?? []), ...(d.commitments ?? [])].map((c: any) => c.category))];
  const listTotal = (tab === 'actual' ? costs : commits).reduce((a: number, c: any) => a + toNum(c.amount), 0);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        back={{ href: '/cost', label: 'Cost control' }}
        title={p.name}
        description={<span className="flex flex-wrap items-center gap-2">{p.code} <Badge status={p.status} /> <Badge status={t.alert} />
          {!p.rapApprovedAt && <span className="text-warn">RAP belum ditetapkan</span>}</span>}
        actions={<Link href={`/projects/${p.id}`} className="inline-flex h-9 items-center rounded-lg border border-line-strong px-3 text-sm font-medium hover:bg-hover">Buka proyek</Link>}
      />

      <Panel>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Fig label={toNum(p.rabTotal) ? 'Nilai kontrak (RAB)' : 'Nilai kontrak'} value={money(pu)} />
          <Fig label="Budget RAP" value={money(t.budget)} sub={pu ? `BK/PU RAP ${pct((toNum(t.budget) / pu) * 100, 2)}` : undefined} />
          <Fig label="Commitment" value={money(t.commitment)} sub={`${d.commitments.length} baris PO terbuka`} />
          <Fig label="Actual" value={money(t.actual)} sub={`${d.costs.length} transaksi`} />
          <Fig label="EAC" value={money(t.eac)} sub={`terpakai ${pct(t.usedPct, 1)}`} tone={t.usedPct >= 100 ? 'bad' : t.usedPct >= 80 ? 'warn' : undefined} />
          <Fig label="Varian" value={money(t.variance)} tone={toNum(t.variance) < 0 ? 'bad' : 'ok'} sub="budget − EAC" />
          <Fig label="Forecast margin" value={d.forecastMargin === null ? '—' : money(d.forecastMargin)} tone={d.forecastMargin !== null && toNum(d.forecastMargin) < 0 ? 'bad' : 'ok'}
            sub={d.forecastMargin !== null && pu ? `${pct((toNum(d.forecastMargin) / pu) * 100, 1)} dari kontrak` : undefined} />
          <Fig label="CPI" value={d.cpi === null ? '—' : d.cpi.toFixed(2)} tone={d.cpi === null ? undefined : d.cpi < 0.9 ? 'bad' : d.cpi < 1 ? 'warn' : 'ok'} sub={`EV ${money(d.earnedValue)}`} />
        </div>
        <div className="mt-5"><BudgetBar budget={t.budget} actual={t.actual} commitment={t.commitment} /></div>
      </Panel>

      <Panel title="Budget vs biaya per kategori" bodyClass="p-0">
          {!rows.length ? <Empty title="Belum ada budget atau biaya" /> : (
            <Table>
              <thead><tr><Th>Kategori</Th><Th right>Budget</Th><Th right>Commitment</Th><Th right>Actual</Th><Th right>Sisa (ETC)</Th><Th right>EAC</Th><Th right>Varian</Th><Th className="w-40">Pemakaian</Th><Th>Status</Th></tr></thead>
              <tbody>
                {rows.map((r: any) => (
                  <Tr key={r.category} onClick={() => setCat(cat === r.category ? '' : r.category)} className={cat === r.category ? 'bg-ink/5' : ''}>
                    <Td className="font-medium">{CATEGORY_LABEL[r.category] ?? r.category}</Td>
                    <Td right>{rupiah(r.budget)}</Td>
                    <Td right>{rupiah(r.commitment)}</Td>
                    <Td right>{rupiah(r.actual)}</Td>
                    <Td right className="text-muted">{rupiah(r.etc)}</Td>
                    <Td right className="font-medium">{rupiah(r.eac)}</Td>
                    <Td right className={toNum(r.variance) < 0 ? 'text-bad' : ''}>{rupiah(r.variance)}</Td>
                    <Td><BudgetBar budget={r.budget} actual={r.actual} commitment={r.commitment} /><div className="num mt-1 text-xs text-muted">{pct(r.usedPct, 0)}</div></Td>
                    <Td><Badge status={r.alert} /></Td>
                  </Tr>
                ))}
                <tr className="bg-hover font-semibold">
                  <Td>Total</Td><Td right>{rupiah(t.budget)}</Td><Td right>{rupiah(t.commitment)}</Td><Td right>{rupiah(t.actual)}</Td>
                  <Td right>{rupiah(t.etc)}</Td><Td right>{rupiah(t.eac)}</Td><Td right className={toNum(t.variance) < 0 ? 'text-bad' : ''}>{rupiah(t.variance)}</Td><Td colSpan={2} />
                </tr>
              </tbody>
            </Table>
          )}
          <p className="border-t border-line px-5 py-2.5 text-xs text-muted">Klik kategori untuk memfilter daftar biaya di bawah.</p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Biaya vs progres fisik">
            <CostVsProgress used={toNum(t.usedPct)} progress={toNum(p.progressPct)} />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Fig label="Earned value" value={money(d.earnedValue)} sub="budget × progres fisik" />
              <Fig label="CPI" value={d.cpi === null ? '—' : d.cpi.toFixed(2)} tone={d.cpi === null ? undefined : d.cpi < 0.9 ? 'bad' : d.cpi < 1 ? 'warn' : 'ok'} sub={d.cpi === null ? 'belum ada actual' : d.cpi < 1 ? 'lebih boros dari progres' : 'sesuai / lebih hemat'} />
              <Fig label="BK/PU saat ini" value={p.bkpuSaatIniPct === null ? '—' : pct(p.bkpuSaatIniPct, 2)} sub={p.bkpuPenetapanPct !== null ? `penetapan ${pct(p.bkpuPenetapanPct, 2)}` : 'penetapan belum ada'} />
              <Fig label="Efisiensi" value={p.efisiensiPct === null ? '—' : `${p.efisiensiPct > 0 ? '+' : ''}${num(p.efisiensiPct, 2)} poin`} tone={p.efisiensiPct === null ? undefined : p.efisiensiPct < 0 ? 'bad' : 'ok'} />
            </div>
          </Panel>
          <Panel title="Tren actual kumulatif">
            {chart.length < 1 ? <Empty title="Belum ada actual cost" /> : (
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={chart} margin={{ top: 8, right: 8, left: 8 }}>
                    <CartesianGrid vertical={false} stroke="#DDE5E7" />
                    <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5B7078' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5B7078' }} tickFormatter={(v) => money(v).replace('Rp ', '')} width={56} />
                    <Tooltip formatter={(v: any) => rupiah(v)} />
                    {toNum(t.budget) > 0 && <ReferenceLine y={toNum(t.budget)} stroke="#A65E2E" strokeDasharray="4 4" label={{ value: 'Budget', fontSize: 11, fill: '#A65E2E', position: 'insideTopRight' }} />}
                    <Line type="monotone" dataKey="actual" name="Actual kumulatif" stroke="#0A4152" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
      </div>

      <Panel
        bodyClass="p-0"
        title={
          <Tabs<Tab> value={tab} onChange={setTab} items={[
            { value: 'actual', label: 'Actual cost', count: d.costs.length },
            { value: 'commitment', label: 'Commitment (PO terbuka)', count: d.commitments.length },
          ]} />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'actual' ? 'Cari uraian, invoice, PO' : 'Cari PO, supplier, item'} className="h-8 w-56 pl-8 text-[13px]" />
            </div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-[13px]">
              <option value="">Semua kategori</option>
              {usedCats.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}
            </select>
            <span className="num text-[13px] font-semibold">{rupiah(listTotal)}</span>
          </div>
        }
      >
        {tab === 'actual' ? (
          !costs.length ? <Empty title="Belum ada biaya diakui">Biaya masuk saat invoice supplier diposting.</Empty> : (
            <Table minWidth={900}>
              <thead><tr><Th>Tanggal</Th><Th>Uraian</Th><Th>Kategori</Th><Th>Invoice</Th><Th>PO</Th><Th right>Jumlah</Th></tr></thead>
              <tbody>
                {costs.map((c: any) => (
                  <Tr key={c.id}>
                    <Td className="whitespace-nowrap">{date(c.costDate)}</Td>
                    <Td><div className="max-w-[360px] truncate">{c.description}</div>{c.supplierRef && <div className="text-xs text-muted">Ref. supplier {c.supplierRef}</div>}</Td>
                    <Td>{CATEGORY_LABEL[c.category] ?? c.category}</Td>
                    <Td className="whitespace-nowrap">{c.invoiceNumber ?? '—'}</Td>
                    <Td className="whitespace-nowrap">{c.poId ? <Link href={`/procurement/po/${c.poId}`} className="text-ink-2 hover:underline">{c.poNumber}</Link> : '—'}</Td>
                    <Td right className="font-medium">{rupiah(c.amount)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )
        ) : !commits.length ? <Empty title="Tidak ada commitment terbuka">Semua PO yang disetujui sudah ditagih supplier.</Empty> : (
          <Table minWidth={1000}>
            <thead><tr><Th>PO</Th><Th>Supplier</Th><Th>Item</Th><Th>Kategori</Th><Th right>Sisa belum ditagih</Th><Th right>Diterima</Th><Th right>Harga</Th><Th right>Nilai</Th></tr></thead>
            <tbody>
              {commits.map((c: any) => (
                <Tr key={c.id} href={`/procurement/po/${c.poId}`}>
                  <Td className="whitespace-nowrap"><div className="font-medium">{c.poNumber}</div><Badge status={c.poStatus} /></Td>
                  <Td><div className="max-w-[200px] truncate">{c.supplier}</div><div className="text-xs text-muted">{date(c.orderDate)}{c.deliveryDate ? ` · kirim ${date(c.deliveryDate)}` : ''}</div></Td>
                  <Td><div className="max-w-[280px] truncate">{c.description}</div></Td>
                  <Td>{CATEGORY_LABEL[c.category] ?? c.category}</Td>
                  <Td right>{num(c.openQty, 4)} {c.unit ?? ''}</Td>
                  <Td right className="text-muted">{num(c.receivedQty, 4)}</Td>
                  <Td right>{rupiah(c.unitPrice)}</Td>
                  <Td right className="font-medium">{rupiah(c.amount)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <CostLegend />
      <CostTerms />
    </div>
  );
}
