'use client';

import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, BudgetBar, Empty, ErrorBox, Loading, PageHeader, Panel, PlanBar, Stat, Table, Td, Th, Tr } from '@/components/ui';
import { can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime, monthLabel, pct, rupiahShort, toNum } from '@/lib/format';

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'membuat', UPDATE: 'mengubah', SUBMIT: 'mengajukan', POST: 'memposting', PAY: 'membayar', RECEIVE: 'menerima pembayaran',
  ISSUE: 'menerbitkan', APPROVAL_APPROVE: 'menyetujui', APPROVAL_REJECT: 'menolak', APPROVAL_REVISION: 'meminta revisi',
  PROGRESS: 'memperbarui progres', DAILY_REPORT: 'mengisi laporan harian', ASSIGN: 'mengalokasikan', TRANSFER: 'mentransfer',
  RETURN: 'mengembalikan', MAINTENANCE: 'menjadwalkan maintenance', WON: 'menandai menang', LOST: 'menandai kalah',
  UPDATE_BQ: 'mengubah BQ', REVERSE: 'membalik', CREATE_FROM_TENDER: 'membuat dari tender', STATUS_ACTIVE: 'mengaktifkan',
  UPLOAD: 'mengunggah lampiran di', QUOTATION: 'mencatat penawaran di', AWARD: 'memilih pemenang', STOCK_ISSUE: 'mencatat pemakaian material di',
  STOCK_TRANSFER: 'mentransfer stok di', STOCK_OPNAME: 'melakukan stock opname di', MAINTENANCE_DONE: 'menyelesaikan maintenance', CANCEL: 'membatalkan',
};
const ENTITY_LABEL: Record<string, string> = {
  PurchaseRequest: 'PR', PurchaseOrder: 'PO', SupplierInvoice: 'invoice supplier', CustomerInvoice: 'invoice owner', Project: 'proyek',
  Tender: 'tender', Asset: 'aset', GoodsReceipt: 'penerimaan barang', JournalEntry: 'jurnal', PR: 'PR', PO: 'PO',
  Rfq: 'RFQ', VariationOrder: 'variation order', VO: 'VO', Warehouse: 'gudang', DailyReport: 'laporan harian',
};

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any>('/dashboard/executive');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const k = data.kpi;
  const marginPct = toNum(k.contractValue) ? (toNum(k.forecastMargin) / toNum(k.contractValue)) * 100 : 0;
  const tenderOpen = (data.tenders.DRAFT ?? 0) + (data.tenders.REVIEW ?? 0) + (data.tenders.SUBMITTED ?? 0);
  const finance = can(user, 'finance:read');

  return (
    <div className="animate-rise">
      <PageHeader
        title={`${greeting()}, ${user?.name.split(' ')[0]}`}
        description={`${k.activeProjects} proyek berjalan, ${k.pendingApprovals} dokumen menunggu approval, ${tenderOpen} tender dalam proses.`}
      />

      {/* KPI strip */}
      <section className="mb-6 grid grid-cols-2 divide-line rounded-xl border border-line bg-surface md:grid-cols-3 xl:grid-cols-6 xl:divide-x [&>*]:px-5 [&>*]:py-4">
        <Stat label="Nilai kontrak" value={rupiahShort(k.contractValue)} sub={`${k.totalProjects} proyek`} />
        <Stat label="Budget biaya" value={rupiahShort(k.budget)} sub={`Terpakai ${pct(toNum(k.budget) ? ((toNum(k.actual) + toNum(k.commitment)) / toNum(k.budget)) * 100 : 0, 0)}`} />
        <Stat label="Forecast margin" value={rupiahShort(k.forecastMargin)} sub={pct(marginPct)} tone={marginPct < 0 ? 'bad' : undefined} />
        <Stat label="Sudah ditagih" value={rupiahShort(k.billed)} sub="Gross progress claim" />
        <Stat label="Piutang owner" value={rupiahShort(k.arOutstanding)} sub="Belum diterima" />
        <Stat label={finance ? 'Kas & bank' : 'Hutang supplier'} value={rupiahShort(finance ? k.cashBalance : k.apOutstanding)} sub={finance ? `Hutang ${rupiahShort(k.apOutstanding)}` : 'Belum dibayar'} />
      </section>

      {/* Proyek */}
      <Panel
        title="Proyek berjalan"
        subtitle="Progres aktual terhadap rencana, dan pemakaian budget (actual + commitment)"
        actions={<Link href="/projects" className="text-[13px] font-medium text-ink-2 hover:text-ink">Semua proyek</Link>}
        bodyClass="p-0"
        className="mb-6"
      >
        {data.projects.length === 0 ? (
          <Empty title="Belum ada proyek">Menangkan tender atau buat proyek baru untuk mulai mencatat.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Proyek</Th>
                <Th className="w-[22%]">Progres fisik</Th>
                <Th className="w-[22%]">Budget terpakai</Th>
                <Th right>Kontrak</Th>
                <Th right>Margin</Th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p: any) => (
                <Tr key={p.id} href={`/projects/${p.id}`}>
                  <Td>
                    <div className="font-medium text-ink">{p.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      {p.code} <Badge status={p.status} />
                    </div>
                  </Td>
                  <Td>
                    <PlanBar actual={p.progressPct} planned={p.plannedPct} />
                    <div className="num mt-1.5 flex justify-between text-xs text-muted">
                      <span className="font-medium text-ink">{pct(p.progressPct, 0)}</span>
                      <span>rencana {pct(p.plannedPct, 0)}</span>
                    </div>
                  </Td>
                  <Td>
                    {toNum(p.budget) > 0 ? (
                      <>
                        <BudgetBar budget={p.budget} actual={p.actual} commitment={p.commitment} />
                        <div className="num mt-1.5 flex justify-between text-xs text-muted">
                          <span className={p.alert === 'OVER' ? 'font-medium text-bad' : 'font-medium text-ink'}>{pct(p.usedPct, 0)}</span>
                          <span>{rupiahShort(p.budget)}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted">Budget belum disusun</span>
                    )}
                  </Td>
                  <Td right className="font-medium">{rupiahShort(p.contractValue)}</Td>
                  <Td right>{p.forecastMarginPct === null ? <span className="text-muted">—</span> : <span className={toNum(p.forecastMarginPct) < 0 ? 'text-bad' : ''}>{pct(p.forecastMarginPct)}</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {finance ? (
          <Panel title="Arus kas 6 bulan" subtitle="Penerimaan dan pengeluaran pada akun kas & bank">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.cashflow.map((m: any) => ({ ...m, label: monthLabel(m.month) }))} barGap={2} margin={{ left: 0, right: 0, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="#DDE5E7" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5B7078' }} />
                  <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: '#5B7078' }} tickFormatter={(v) => rupiahShort(v).replace('Rp ', '')} />
                  <Tooltip
                    cursor={{ fill: '#F5F8F9' }}
                    contentStyle={{ borderRadius: 10, border: '1px solid #DDE5E7', fontSize: 12 }}
                    formatter={(v: any, n: any) => [rupiahShort(v), n === 'inflow' ? 'Masuk' : 'Keluar']}
                  />
                  <Bar dataKey="inflow" fill="#0A4152" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="outflow" fill="#A65E2E" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-5 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ink" /> Masuk</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-signal" /> Keluar</span>
            </div>
          </Panel>
        ) : (
          <Panel title="Ringkasan tender">
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Dalam proses" value={tenderOpen} />
              <Stat label="Menang" value={data.tenders.WON ?? 0} tone="ok" />
              <Stat label="Kalah" value={data.tenders.LOST ?? 0} />
            </div>
          </Panel>
        )}

        <Panel title="Aktivitas terbaru" bodyClass="p-0">
          <ul className="divide-y divide-line">
            {data.recent.map((a: any) => (
              <li key={a.id} className="flex gap-3 px-5 py-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
                <div className="min-w-0">
                  <p className="text-ink-2">
                    <span className="font-medium text-ink">{a.actorName}</span> {ACTION_LABEL[a.action] ?? a.action.toLowerCase()}{' '}
                    {ENTITY_LABEL[a.entityType] ?? a.entityType}
                    {a.metadata?.number ? <span className="font-medium text-ink"> {a.metadata.number}</span> : null}
                  </p>
                  <p className="text-xs text-muted">{dateTime(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
