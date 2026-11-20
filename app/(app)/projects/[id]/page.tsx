'use client';

import { bulkCreate, clean, ExcelImport } from '@/components/excel-import';
import { use, useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Badge, Button, BudgetBar, Empty, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, Panel, PlanBar, Stat, Table, Tabs, Td, Textarea, Th, Tr } from '@/components/ui';
import { Attachments } from '@/components/attachments';
import { ExportButton } from '@/components/export-button';
import { VariationOrders } from '@/components/variation-orders';
import { BkPu, Efisiensi, Penetapan } from '@/components/bkpu';
import { ProjectPhoto, ProjectPhotoEditor } from '@/components/project-photo';
import { ProjectSwitcher } from '@/components/project-switcher';
import { Pencil } from 'lucide-react';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABEL, date, num, pct, rupiah, rupiahShort, today, toNum } from '@/lib/format';

const NEXT_STATUS: Record<string, [string, string][]> = {
  SETUP: [['ACTIVE', 'Mulai proyek']],
  ACTIVE: [['ON_HOLD', 'Tunda'], ['COMPLETION', 'Serah terima']],
  ON_HOLD: [['ACTIVE', 'Lanjutkan']],
  COMPLETION: [['CLOSED', 'Tutup proyek']],
};

type Tab = 'overview' | 'cost' | 'bq' | 'vo' | 'progress' | 'procurement' | 'billing' | 'docs';

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: p, error, loading, reload } = useApi<any>(`/projects/${id}`);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState('');
  const [editBkpu, setEditBkpu] = useState(false);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    if (t) setTab(t);
  }, []);

  if (loading && !p) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!p) return null;
  const write = can(user, 'project:write');

  async function setStatus(status: string) {
    setBusy(status);
    try {
      await api(`/projects/${id}`, { method: 'PATCH', body: { status } });
      toast.success('Status proyek diperbarui');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  const t = p.cost.total;

  return (
    <div className="animate-rise flex gap-6">
      <ProjectSwitcher key={p.coverFileId ?? "none"} activeId={id} />
      <div className="min-w-0 flex-1">
      <div className="flex items-start gap-4">
        <ProjectPhotoEditor projectId={id} fileId={p.coverFileId} title={p.coverTitle} canEdit={write} onChanged={reload} className="mt-7 size-[72px]" />
        <div className="min-w-0 flex-1">
      <PageHeader
        back={{ href: '/projects', label: 'Proyek' }}
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {p.code} <Badge status={p.status} /> <span>{p.ownerName ?? 'Tanpa owner'}</span>
          </span>
        }
        actions={write && NEXT_STATUS[p.status]?.map(([s, l], i) => (
          <Button key={s} variant={i === 0 ? 'primary' : 'secondary'} loading={busy === s} onClick={() => setStatus(s)}>{l}</Button>
        ))}
      />
        </div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5 [&>*]:bg-surface [&>*]:px-5 [&>*]:py-4">
        <Stat label="Nilai kontrak" value={rupiahShort(p.contractValue)} />
        <div>
          <div className="text-[13px] text-muted">Progres fisik</div>
          <div className="num mt-1 text-[22px] font-semibold tracking-[-0.02em]">{pct(p.progressPct, 0)}</div>
          <PlanBar actual={p.progressPct} planned={p.plannedPct} className="mt-2" />
        </div>
        <Stat label="Budget biaya" value={rupiahShort(t.budget)} sub={`Terpakai ${pct(t.usedPct, 0)}`} tone={t.alert === 'OVER' ? 'bad' : undefined} />
        <Stat label="Sudah ditagih" value={rupiahShort(p.finance.billedGross)} sub={`Diterima ${rupiahShort(p.finance.received)}`} />
        <Stat label="Forecast margin" value={p.finance.forecastMargin === null ? '—' : rupiahShort(p.finance.forecastMargin)} tone={toNum(p.finance.forecastMargin) < 0 ? 'bad' : undefined} />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>*]:bg-surface [&>*]:px-5 [&>*]:py-4">
        <div>
          <div className="flex items-center justify-between gap-2 text-[13px] text-muted">
            BK/PU penetapan
            {write && <button type="button" title="Ubah BK/PU penetapan" onClick={() => setEditBkpu(true)} className="rounded p-1 text-muted hover:bg-hover hover:text-ink"><Pencil className="size-3.5" /></button>}
          </div>
          <div className="mt-1 text-[20px] tracking-[-0.02em]"><Penetapan value={p.bkpuPenetapanPct} /></div>
          <div className="mt-0.5 text-xs text-muted">Ditetapkan manajemen</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">BK/PU awal</div>
          <div className="mt-1 text-[20px] tracking-[-0.02em]"><BkPu pct={p.bkpuAwalPct} bk={p.bkAwal} pu={p.puAwal} empty="Belum ada RAP" align="left" /></div>
        </div>
        <div>
          <div className="text-[13px] text-muted">BK/PU saat ini</div>
          <div className="mt-1 text-[20px] tracking-[-0.02em]"><BkPu pct={p.bkpuSaatIniPct} bk={p.bkSaatIni} pu={p.puSaatIni} base={p.bkpuAwalPct} empty="Belum ada progres" align="left" /></div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Efisiensi</div>
          <div className="mt-1 text-[20px] tracking-[-0.02em]"><Efisiensi value={p.efisiensiPct} /></div>
          <div className="mt-0.5 text-xs text-muted">BK/PU awal − BK/PU saat ini</div>
        </div>
      </section>
      <BkpuModal open={editBkpu} onClose={() => setEditBkpu(false)} id={id} value={p.bkpuPenetapanPct} onDone={reload} />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Ringkasan' },
          { value: 'cost', label: 'Budget & biaya' },
          { value: 'bq', label: 'Bill of Quantity' },
          { value: 'vo', label: 'Variation order' },
          { value: 'progress', label: 'Progres & laporan harian' },
          { value: 'procurement', label: 'Pengadaan' },
          { value: 'billing', label: 'Penagihan' },
          { value: 'docs', label: 'Dokumen & foto' },
        ]}
      />

      {tab === 'overview' && <Overview p={p} />}
      {tab === 'cost' && <CostTab p={p} />}
      {tab === 'bq' && <BqTab id={id} />}
      {tab === 'progress' && <ProgressTab p={p} write={write} reload={reload} />}
      {tab === 'procurement' && <ProcTab id={id} />}
      {tab === 'billing' && <BillingTab p={p} />}
      {tab === 'vo' && <VariationOrders projectId={id} canWrite={write} onChanged={reload} />}
      {tab === 'docs' && <Attachments entityType="Project" entityId={id} title="Dokumen proyek (kontrak, gambar, RFI, foto)" canUpload={write} />}
      </div>
    </div>
  );
}

function BkpuModal({ open, onClose, id, value, onDone }: { open: boolean; onClose: () => void; id: string; value: any; onDone: () => void }) {
  const [v, setV] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setV(value === null || value === undefined ? '' : String(Number(value)));
  }, [open, value]);
  async function save() {
    setSaving(true);
    try {
      await api(`/projects/${id}`, { method: 'PATCH', body: { bkpuPenetapanPct: v.trim() } });
      toast.success('BK/PU penetapan disimpan');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="BK/PU penetapan"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving}>Simpan</Button></>}>
      <Field label="BK/PU penetapan (%)" hint="Rasio biaya konstruksi ÷ pendapatan usaha yang ditetapkan manajemen. Kosongkan untuk menghapus.">
        <Input type="number" step="0.01" min={0} max={999} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

function Overview({ p }: { p: any }) {
  const chart = p.progress.map((e: any) => ({ d: date(e.reportDate), plan: toNum(e.plannedPct), actual: toNum(e.actualPct) }));
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
      {p.coverFileId && (
        <Panel className="xl:col-span-2" bodyClass="p-0">
          <figure>
            <ProjectPhoto fileId={p.coverFileId} alt={p.coverTitle ?? p.name} className="h-72 w-full rounded-none rounded-t-xl ring-0" />
            <figcaption className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="font-medium">{p.coverTitle || 'Foto proyek'}</span>
              <span className="text-xs text-muted">Klik foto di sebelah nama proyek untuk mengganti foto atau judul</span>
            </figcaption>
          </figure>
        </Panel>
      )}
      <Panel title="Data kontrak">
        <KV
          items={[
            ['Owner', p.ownerName],
            ['Lokasi', p.location],
            ['Project manager', p.managerName],
            ['Perusahaan', p.company?.name],
            ['Mulai', date(p.startDate)],
            ['Selesai', date(p.endDate)],
            ['Retensi', pct(p.retentionPct)],
            ['Mata uang', p.currency],
          ]}
        />
      </Panel>
      <Panel title="Kurva progres" subtitle="Rencana vs aktual (kumulatif)">
        {chart.length === 0 ? (
          <Empty title="Belum ada catatan progres" />
        ) : (
          <div className="h-60">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 8, right: 8, left: -16 }}>
                <CartesianGrid vertical={false} stroke="#DDE5E7" />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5B7078' }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5B7078' }} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DDE5E7', fontSize: 12 }} formatter={(v: any, n: any) => [`${v}%`, n === 'plan' ? 'Rencana' : 'Aktual']} />
                <Line dataKey="plan" stroke="#0A4152" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                <Line dataKey="actual" stroke="#A65E2E" strokeWidth={3} dot={{ r: 3, fill: '#A65E2E' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CostTab({ p }: { p: any }) {
  const { data: costs } = useApi<any[]>(`/projects/${p.id}/costs`);
  const t = p.cost.total;
  return (
    <div className="space-y-6">
      <Panel
        title="Kontrol biaya per kategori"
        subtitle="Commitment = PO disetujui yang belum ditagih. EAC = actual + commitment + sisa budget."
        bodyClass="p-0"
      >
        <Table>
          <thead>
            <tr>
              <Th>Kategori</Th>
              <Th right>Budget</Th>
              <Th right>Commitment</Th>
              <Th right>Actual</Th>
              <Th right>EAC</Th>
              <Th right>Varian</Th>
              <Th className="w-44">Pemakaian</Th>
            </tr>
          </thead>
          <tbody>
            {p.cost.rows.filter((r: any) => toNum(r.budget) || toNum(r.actual) || toNum(r.commitment)).map((r: any) => (
              <Tr key={r.category}>
                <Td className="font-medium">{CATEGORY_LABEL[r.category]}</Td>
                <Td right>{rupiah(r.budget)}</Td>
                <Td right>{rupiah(r.commitment)}</Td>
                <Td right>{rupiah(r.actual)}</Td>
                <Td right>{rupiah(r.eac)}</Td>
                <Td right className={toNum(r.variance) < 0 ? 'text-bad' : ''}>{rupiah(r.variance)}</Td>
                <Td>
                  <BudgetBar budget={r.budget} actual={r.actual} commitment={r.commitment} />
                  <div className="num mt-1 text-xs text-muted">{pct(r.usedPct, 0)}</div>
                </Td>
              </Tr>
            ))}
            <tr className="bg-hover font-semibold">
              <Td>Total</Td>
              <Td right>{rupiah(t.budget)}</Td>
              <Td right>{rupiah(t.commitment)}</Td>
              <Td right>{rupiah(t.actual)}</Td>
              <Td right>{rupiah(t.eac)}</Td>
              <Td right className={toNum(t.variance) < 0 ? 'text-bad' : ''}>{rupiah(t.variance)}</Td>
              <Td><Badge status={t.alert} /></Td>
            </tr>
          </tbody>
        </Table>
      </Panel>
      <Panel title="Actual cost tercatat" bodyClass="p-0">
        {!costs?.length ? (
          <Empty title="Belum ada biaya diakui">Biaya masuk saat invoice supplier diposting.</Empty>
        ) : (
          <Table>
            <thead><tr><Th>Tanggal</Th><Th>Keterangan</Th><Th>Kategori</Th><Th right>Nilai</Th></tr></thead>
            <tbody>
              {costs.map((c) => (
                <Tr key={c.id}>
                  <Td className="text-muted">{date(c.costDate)}</Td>
                  <Td>{c.description}</Td>
                  <Td>{CATEGORY_LABEL[c.category]}</Td>
                  <Td right>{rupiah(c.amount)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

function BqTab({ id }: { id: string }) {
  const { data, loading } = useApi<any[]>(`/projects/${id}/bq/items`);
  if (loading) return <Loading />;
  if (!data?.length) return <Panel><Empty title="BQ kosong">Proyek manual belum memiliki BQ. BQ otomatis tersalin dari tender yang menang.</Empty></Panel>;
  const sections = [...new Set(data.map((i) => i.section))];
  const total = data.reduce((a, i) => a + toNum(i.amount), 0);
  return (
    <Panel title="Bill of Quantity kontrak" subtitle="Snapshot harga jual dari tender — tidak berubah oleh revisi tender" bodyClass="p-0" actions={<ExportButton size="sm" path={`/exports/bq.xlsx?projectId=${id}`} />}>
      <Table>
        <thead><tr><Th>Kode</Th><Th>Uraian</Th><Th right>Volume</Th><Th>Sat.</Th><Th right>Harga satuan</Th><Th right>Jumlah</Th></tr></thead>
        <tbody>
          {sections.map((s) => (
            <SectionRows key={s} title={s} items={data.filter((i) => i.section === s)} />
          ))}
          <tr className="bg-hover font-semibold"><Td colSpan={5}>Total nilai BQ</Td><Td right>{rupiah(total)}</Td></tr>
        </tbody>
      </Table>
    </Panel>
  );
}
function SectionRows({ title, items }: { title: string; items: any[] }) {
  const sub = items.reduce((a, i) => a + toNum(i.amount), 0);
  return (
    <>
      <tr className="bg-canvas/60">
        <Td colSpan={5} className="font-semibold text-ink">{title}</Td>
        <Td right className="font-semibold">{rupiah(sub)}</Td>
      </tr>
      {items.map((i) => (
        <Tr key={i.id}>
          <Td className="text-muted">{i.code}</Td>
          <Td>{i.description}</Td>
          <Td right>{num(i.quantity, 6)}</Td>
          <Td className="text-muted">{i.unit}</Td>
          <Td right>{rupiah(i.unitPrice)}</Td>
          <Td right>{rupiah(i.amount)}</Td>
        </Tr>
      ))}
    </>
  );
}

function ProgressTab({ p, write, reload }: { p: any; write: boolean; reload: () => void }) {
  const [mode, setMode] = useState<'' | 'progress' | 'daily'>('');
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const open = (m: 'progress' | 'daily') => {
    setF(m === 'progress'
      ? { reportDate: today(), plannedPct: String(toNum(p.plannedPct)), actualPct: String(toNum(p.progressPct)), notes: '' }
      : { reportDate: today(), weather: 'Cerah', manpower: '0', activities: '', issues: '' });
    setMode(m);
  };
  async function save() {
    setSaving(true);
    try {
      if (mode === 'progress') await api(`/projects/${p.id}/progress`, { body: f });
      else await api(`/projects/${p.id}/daily-reports`, { body: { ...f, manpower: Number(f.manpower) } });
      toast.success(mode === 'progress' ? 'Progres tersimpan' : 'Laporan harian tersimpan');
      setMode('');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Catatan progres" actions={write && (
        <div className="flex flex-wrap gap-2">
          <ExcelImport
            title="Impor progres (kurva S) dari Excel"
            templateName={`progres-${p.code}`}
            hint="Satu baris per tanggal laporan. Persentase kumulatif 0–100."
            columns={[
              { key: 'reportDate', header: 'Tanggal', type: 'date', required: true },
              { key: 'plannedPct', header: 'Rencana kumulatif (%)', type: 'number', required: true, width: 22 },
              { key: 'actualPct', header: 'Aktual kumulatif (%)', type: 'number', required: true, width: 22 },
              { key: 'notes', header: 'Catatan', width: 36 },
            ]}
            resolve={(r) => (Number(r.plannedPct) < 0 || Number(r.plannedPct) > 100 || Number(r.actualPct) < 0 || Number(r.actualPct) > 100 ? 'persentase harus 0–100' : r)}
            onApply={async (rows, _m, lines) => {
              const order = rows.map((r, i) => ({ r, l: lines[i] })).sort((a, b) => a.r.reportDate.localeCompare(b.r.reportDate));
              const res = await bulkCreate(order.map((x) => x.r), order.map((x) => x.l), (r) => api(`/projects/${p.id}/progress`, { body: clean(r) }));
              reload();
              return res;
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => open('progress')}>Catat progres</Button>
        </div>
      )} bodyClass="p-0">
        {p.progress.length === 0 ? <Empty title="Belum ada progres" /> : (
          <Table>
            <thead><tr><Th>Tanggal</Th><Th right>Rencana</Th><Th right>Aktual</Th><Th right>Deviasi</Th></tr></thead>
            <tbody>
              {[...p.progress].reverse().map((e: any) => {
                const dev = toNum(e.actualPct) - toNum(e.plannedPct);
                return (
                  <Tr key={e.id}>
                    <Td>{date(e.reportDate)}</Td>
                    <Td right>{pct(e.plannedPct)}</Td>
                    <Td right className="font-medium">{pct(e.actualPct)}</Td>
                    <Td right className={dev < 0 ? 'text-bad' : 'text-ok'}>{dev > 0 ? '+' : ''}{pct(dev)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
      <Panel title="Laporan harian" actions={write && (
        <div className="flex flex-wrap gap-2">
          <ExcelImport
            title="Impor laporan harian dari Excel"
            templateName={`laporan-harian-${p.code}`}
            hint="Foto tetap diunggah per laporan setelah impor."
            columns={[
              { key: 'reportDate', header: 'Tanggal', type: 'date', required: true },
              { key: 'weather', header: 'Cuaca', type: 'enum', options: ['Cerah', 'Berawan', 'Hujan ringan', 'Hujan lebat'].map((c) => ({ value: c, label: c })) },
              { key: 'manpower', header: 'Jumlah pekerja', type: 'integer', required: true },
              { key: 'activities', header: 'Pekerjaan hari ini', required: true, width: 44 },
              { key: 'issues', header: 'Kendala', width: 30 },
            ]}
            onApply={async (rows, _m, lines) => {
              const res = await bulkCreate(rows, lines, (r) => api(`/projects/${p.id}/daily-reports`, { body: { ...clean(r), manpower: Number(r.manpower) } }));
              reload();
              return res;
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => open('daily')}>Isi laporan</Button>
        </div>
      )} bodyClass="p-0">
        {p.dailyReports.length === 0 ? <Empty title="Belum ada laporan harian" /> : (
          <ul className="divide-y divide-line">
            {p.dailyReports.map((r: any) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{date(r.reportDate)}</span>
                  <span className="text-xs text-muted">{r.weather} — {r.manpower} pekerja</span>
                </div>
                <p className="mt-1.5 text-sm text-ink-2">{r.activities}</p>
                {r.issues && <p className="mt-1.5 rounded-md bg-warn-soft px-2.5 py-1.5 text-xs text-warn">Kendala: {r.issues}</p>}
                <DailyPhotos id={r.id} canWrite={write} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={!!mode} onClose={() => setMode('')} title={mode === 'progress' ? 'Catat progres' : 'Laporan harian'}
        footer={<><Button variant="secondary" onClick={() => setMode('')}>Batal</Button><Button onClick={save} loading={saving}>Simpan</Button></>}>
        {mode === 'progress' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tanggal"><Input type="date" value={f.reportDate} onChange={set('reportDate')} /></Field>
            <Field label="Rencana kumulatif (%)"><Input type="number" value={f.plannedPct} onChange={set('plannedPct')} /></Field>
            <Field label="Aktual kumulatif (%)"><Input type="number" value={f.actualPct} onChange={set('actualPct')} /></Field>
            <Field label="Catatan" className="sm:col-span-3" hint="Progres fisik tidak otomatis menjadi progres penagihan."><Textarea value={f.notes} onChange={set('notes')} /></Field>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tanggal"><Input type="date" value={f.reportDate} onChange={set('reportDate')} /></Field>
            <Field label="Cuaca"><Input value={f.weather} onChange={set('weather')} /></Field>
            <Field label="Jumlah pekerja"><Input type="number" value={f.manpower} onChange={set('manpower')} /></Field>
            <Field label="Pekerjaan hari ini" className="sm:col-span-3"><Textarea value={f.activities} onChange={set('activities')} /></Field>
            <Field label="Kendala" className="sm:col-span-3"><Textarea value={f.issues} onChange={set('issues')} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProcTab({ id }: { id: string }) {
  const { data: prs } = useApi<any[]>(`/purchase-requests?projectId=${id}`);
  const { data: pos } = useApi<any[]>(`/purchase-orders?projectId=${id}`);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Purchase request" bodyClass="p-0">
        {!prs?.length ? <Empty title="Belum ada PR" /> : (
          <Table><thead><tr><Th>Nomor</Th><Th>Status</Th><Th right>Estimasi</Th></tr></thead>
            <tbody>{prs.map((r) => <Tr key={r.id} href={`/procurement/pr/${r.id}`}><Td className="font-medium">{r.number}</Td><Td><Badge status={r.status} /></Td><Td right>{rupiahShort(r.totalEstimate)}</Td></Tr>)}</tbody>
          </Table>
        )}
      </Panel>
      <Panel title="Purchase order" bodyClass="p-0">
        {!pos?.length ? <Empty title="Belum ada PO" /> : (
          <Table><thead><tr><Th>Nomor</Th><Th>Supplier</Th><Th>Status</Th><Th right>Total</Th></tr></thead>
            <tbody>{pos.map((r) => <Tr key={r.id} href={`/procurement/po/${r.id}`}><Td className="font-medium">{r.number}</Td><Td>{r.supplier.name}</Td><Td><Badge status={r.status} /></Td><Td right>{rupiahShort(r.total)}</Td></Tr>)}</tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

function BillingTab({ p }: { p: any }) {
  const { data } = useApi<any[]>(`/customer-invoices?projectId=${p.id}`);
  return (
    <Panel title="Progress claim & invoice owner" bodyClass="p-0" actions={<a href="/finance/invoices" className="text-[13px] font-medium text-ink-2 hover:text-ink">Kelola penagihan</a>}>
      {!data?.length ? <Empty title="Belum ada tagihan" /> : (
        <Table>
          <thead><tr><Th>Nomor</Th><Th>Keterangan</Th><Th>Tanggal</Th><Th right>Progres</Th><Th right>Total</Th><Th right>Dibayar</Th><Th>Status</Th></tr></thead>
          <tbody>
            {data.map((i) => (
              <Tr key={i.id}>
                <Td className="font-medium">{i.number}</Td><Td>{i.description}</Td><Td className="text-muted">{date(i.invoiceDate)}</Td>
                <Td right>{pct(i.progressPct, 0)}</Td><Td right>{rupiah(i.total)}</Td><Td right>{rupiah(i.paidAmount)}</Td><Td><Badge status={i.displayStatus} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

function DailyPhotos({ id, canWrite }: { id: string; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="mt-3"><Attachments compact entityType="DailyReport" entityId={id} canUpload={canWrite} title="Foto lapangan" category="Foto" /></div>
  ) : (
    <button onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-ink-2 underline-offset-2 hover:underline">Lihat / tambah foto</button>
  );
}
