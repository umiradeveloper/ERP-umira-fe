'use client';

import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { use, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, Panel, Select, Table, Td, Th } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABEL, date, pct, rupiah, today, toNum } from '@/lib/format';
import { ExcelImport } from '@/components/excel-import';
import { CATEGORY_OPTIONS } from '@/lib/excel';

type Row = { section: string; code: string; description: string; unit: string; category: string; costCode?: string; quantity: string; unitCost: string };
const CATS = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OVERHEAD', 'OTHER'];

export default function TenderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: t, error, loading, reload, setData } = useApi<any>(`/tenders/${id}`);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState('');
  const [markup, setMarkup] = useState({ overheadPct: '', contingencyPct: '', profitPct: '', taxPct: '' });
  const [decision, setDecision] = useState(false);

  useEffect(() => {
    if (!t) return;
    setRows(t.items.map((i: any) => ({ section: i.section, code: i.code, description: i.description, unit: i.unit ?? '', category: i.category, costCode: i.costCode ?? '', quantity: String(toNum(i.quantity)), unitCost: String(toNum(i.unitCost)) })));
    setMarkup({ overheadPct: String(toNum(t.overheadPct)), contingencyPct: String(toNum(t.contingencyPct)), profitPct: String(toNum(t.profitPct)), taxPct: String(toNum(t.taxPct)) });
    setDirty(false);
  }, [t]);

  // Kalkulasi estimator di sisi klien (pratinjau); nilai final dihitung ulang di server
  const calc = useMemo(() => {
    const direct = rows.reduce((a, r) => a + Math.round(toNum(r.quantity) * toNum(r.unitCost) * 100) / 100, 0);
    const byCat: Record<string, number> = {};
    rows.forEach((r) => (byCat[r.category] = (byCat[r.category] ?? 0) + toNum(r.quantity) * toNum(r.unitCost)));
    const oh = (direct * toNum(markup.overheadPct)) / 100;
    const cont = (direct * toNum(markup.contingencyPct)) / 100;
    const profit = ((direct + oh + cont) * toNum(markup.profitPct)) / 100;
    const sub = direct + oh + cont + profit;
    const tax = (sub * toNum(markup.taxPct)) / 100;
    return { direct, byCat, oh, cont, profit, sub, tax, total: sub + tax };
  }, [rows, markup]);

  if (loading && !t) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!t) return null;
  const editable = ['DRAFT', 'REVIEW'].includes(t.status) && can(user, 'tender:write');

  const upd = (i: number, k: keyof Row, v: string) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
    setDirty(true);
  };
  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows([...rows, { section: last?.section ?? 'A. Pekerjaan Persiapan', code: '', description: '', unit: '', category: 'MATERIAL', quantity: '0', unitCost: '0' }]);
    setDirty(true);
  };

  async function run(key: string, fn: () => Promise<any>, msg: string) {
    setSaving(key);
    try {
      const r = await fn();
      toast.success(msg);
      return r;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving('');
    }
  }
  const save = () =>
    run('save', async () => {
      await api(`/tenders/${id}`, { method: 'PATCH', body: { title: t.title, customerId: t.customerId ?? undefined, location: t.location ?? undefined, ...markup } });
      const res = await api(`/tenders/${id}/items`, { method: 'PUT', body: { items: rows.filter((r) => r.description).map((r) => ({ ...r, costCode: r.costCode || undefined, unit: r.unit || undefined })) } });
      setData(res);
    }, 'BQ & estimasi tersimpan');

  const sections = [...new Set(rows.map((r) => r.section))];

  return (
    <div className="animate-rise">
      <PageHeader
        back={{ href: '/tenders', label: 'Tender' }}
        title={t.title}
        description={<span className="flex flex-wrap items-center gap-2">{t.number} <Badge status={t.status} /> {t.customer?.name}</span>}
        actions={
          <>
            {editable && <Button variant="secondary" onClick={save} loading={saving === 'save'} disabled={!dirty}>Simpan BQ</Button>}
            {t.status === 'DRAFT' && can(user, 'tender:write') && (
              <Button variant="secondary" disabled={dirty} loading={saving === 'rev'} onClick={() => run('rev', () => api(`/tenders/${id}/review`, { body: {} }), 'Tender masuk review').then(reload)}>Kirim ke review</Button>
            )}
            {editable && (
              <Button disabled={dirty} loading={saving === 'sub'} onClick={() => run('sub', () => api(`/tenders/${id}/submit`, { body: {} }), 'Penawaran diajukan').then(reload)}>Ajukan penawaran</Button>
            )}
            {t.status === 'SUBMITTED' && can(user, 'tender:write') && <Button variant="signal" onClick={() => setDecision(true)}>Catat hasil tender</Button>}
            {t.status === 'WON' && t.projectId && <Link href={`/projects/${t.projectId}`} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white">Buka proyek</Link>}
          </>
        }
      />

      <div className="grid gap-6 2xl:grid-cols-[1fr_340px]">
        <Panel title="Bill of Quantity" subtitle={editable ? 'Isi volume dan harga satuan biaya (AHSP). Harga jual dihitung dari markup.' : 'BQ terkunci setelah penawaran diajukan'} bodyClass="p-0"
          actions={editable && (
            <div className="flex flex-wrap gap-2">
              <ExcelImport
                title="Impor BQ dari Excel"
                templateName={`template-bq-${t.number}`}
                modes
                hint="Template berisi BQ saat ini. Ubah/tambah baris di Excel lalu pilih 'Ganti semua baris'."
                columns={[
                  { key: 'section', header: 'Bagian', required: true, width: 28, note: 'mis. A. Pekerjaan Persiapan' },
                  { key: 'code', header: 'Kode', width: 10 },
                  { key: 'description', header: 'Uraian', required: true, width: 42 },
                  { key: 'unit', header: 'Satuan', width: 10 },
                  { key: 'category', header: 'Kategori', type: 'enum', options: CATEGORY_OPTIONS },
                  { key: 'costCode', header: 'Kode biaya (WBS)', width: 16 },
                  { key: 'quantity', header: 'Volume', type: 'number', required: true },
                  { key: 'unitCost', header: 'Harga satuan', type: 'number', required: true, width: 18 },
                ]}
                prefill={rows.map((r) => ({ ...r, costCode: r.costCode ?? '' }))}
                onApply={(xs, mode) => {
                  const add = xs.map((r) => ({ section: r.section, code: r.code, description: r.description, unit: r.unit, category: r.category || 'MATERIAL', costCode: r.costCode, quantity: r.quantity || '0', unitCost: r.unitCost || '0' }));
                  setRows(mode === 'replace' ? add : [...rows, ...add]);
                  setDirty(true);
                }}
              />
              <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={addRow}>Tambah baris</Button>
            </div>
          )}>
          <Table minWidth={editable ? 1080 : undefined}>
            <thead>
              <tr><Th className="w-44">Bagian</Th><Th className="w-20">Kode</Th><Th className="min-w-[260px]">Uraian</Th><Th className="w-20">Sat.</Th><Th className="w-36">Kategori</Th><Th right className="w-28">Volume</Th><Th right className="w-36">Harga satuan</Th><Th right className="w-40">Jumlah</Th>{editable && <Th className="w-8" />}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const amt = toNum(r.quantity) * toNum(r.unitCost);
                const newSection = i === 0 || rows[i - 1].section !== r.section;
                return editable ? (
                  <tr key={i} className="[&>td]:border-b [&>td]:border-line [&>td]:px-1.5 [&>td]:py-1.5 [&>td:first-child]:pl-4">
                    <td><Input className="h-8 text-[13px]" value={r.section} onChange={(e) => upd(i, 'section', e.target.value)} list="sections" /></td>
                    <td><Input className="h-8 text-[13px]" value={r.code} onChange={(e) => upd(i, 'code', e.target.value)} /></td>
                    <td><Input className="h-8 text-[13px]" value={r.description} onChange={(e) => upd(i, 'description', e.target.value)} /></td>
                    <td><Input className="h-8 text-[13px]" value={r.unit} onChange={(e) => upd(i, 'unit', e.target.value)} /></td>
                    <td><Select className="h-8 text-[13px]" value={r.category} onChange={(e) => upd(i, 'category', e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select></td>
                    <td><Input type="number" className="h-8 text-[13px]" value={r.quantity} onChange={(e) => upd(i, 'quantity', e.target.value)} /></td>
                    <td><Input type="number" className="h-8 text-[13px]" value={r.unitCost} onChange={(e) => upd(i, 'unitCost', e.target.value)} /></td>
                    <td className="num whitespace-nowrap pr-3 text-right text-[13px]">{rupiah(amt)}</td>
                    <td><button className="rounded p-1 text-faint hover:bg-bad-soft hover:text-bad" aria-label="Hapus baris" onClick={() => { setRows(rows.filter((_, x) => x !== i)); setDirty(true); }}><Trash2 className="size-3.5" /></button></td>
                  </tr>
                ) : (
                  <tr key={i} className="[&>td]:border-b [&>td]:border-line">
                    <Td className="text-xs text-muted">{newSection ? r.section : ''}</Td>
                    <Td className="text-muted">{r.code}</Td>
                    <Td>{r.description}</Td>
                    <Td className="text-muted">{r.unit}</Td>
                    <Td className="text-muted">{CATEGORY_LABEL[r.category]}</Td>
                    <Td right>{toNum(r.quantity).toLocaleString('id-ID')}</Td>
                    <Td right>{rupiah(r.unitCost)}</Td>
                    <Td right>{rupiah(amt)}</Td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><Td colSpan={9} className="py-10 text-center text-muted">BQ masih kosong. Tambahkan baris pertama.</Td></tr>}
            </tbody>
          </Table>
          <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
        </Panel>

        <div className="grid gap-6 md:grid-cols-2 2xl:block 2xl:space-y-6">
          <Panel title="Estimasi penawaran">
            <dl className="space-y-2.5 text-sm">
              {Object.entries(calc.byCat).map(([k, v]) => (
                <div key={k} className="flex justify-between text-muted"><dt>{CATEGORY_LABEL[k]}</dt><dd className="num">{rupiah(v)}</dd></div>
              ))}
              <div className="flex justify-between border-t border-line pt-2.5 font-medium"><dt>Biaya langsung</dt><dd className="num">{rupiah(calc.direct)}</dd></div>
              <MarkupRow label="Overhead" k="overheadPct" v={calc.oh} markup={markup} setMarkup={(m) => { setMarkup(m); setDirty(true); }} editable={editable} />
              <MarkupRow label="Contingency" k="contingencyPct" v={calc.cont} markup={markup} setMarkup={(m) => { setMarkup(m); setDirty(true); }} editable={editable} />
              <MarkupRow label="Profit" k="profitPct" v={calc.profit} markup={markup} setMarkup={(m) => { setMarkup(m); setDirty(true); }} editable={editable} />
              <div className="flex justify-between border-t border-line pt-2.5 font-medium"><dt>Harga penawaran</dt><dd className="num">{rupiah(calc.sub)}</dd></div>
              <MarkupRow label="PPN" k="taxPct" v={calc.tax} markup={markup} setMarkup={(m) => { setMarkup(m); setDirty(true); }} editable={editable} />
            </dl>
            <div className="mt-4 rounded-lg bg-ink px-4 py-3 text-white">
              <div className="text-xs text-side-text">Total penawaran termasuk PPN</div>
              <div className="num mt-0.5 text-xl font-semibold">{rupiah(calc.total)}</div>
            </div>
            {dirty && <p className="mt-3 text-xs text-warn">Ada perubahan yang belum disimpan.</p>}
          </Panel>
          <Panel title="Info tender">
            <KV cols={2} items={[['Owner', t.customer?.name], ['Lokasi', t.location], ['Batas penawaran', date(t.deadline)], ['Versi', t.version], ['Margin kotor', pct(calc.sub ? ((calc.sub - calc.direct - calc.oh - calc.cont) / calc.sub) * 100 : 0)]]} />
          </Panel>
        </div>
      </div>

      <DecisionModal open={decision} onClose={() => setDecision(false)} id={id} onDone={reload} />
    </div>
  );
}

function MarkupRow({ label, k, v, markup, setMarkup, editable }: { label: string; k: keyof any; v: number; markup: any; setMarkup: (m: any) => void; editable: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted">
      <dt className="flex items-center gap-2">
        {label}
        {editable ? (
          <span className="flex items-center gap-1">
            <input type="number" value={markup[k]} onChange={(e) => setMarkup({ ...markup, [k]: e.target.value })} className="num h-7 w-14 rounded-md border border-line-strong px-1.5 text-right text-xs focus:border-ink focus:outline-none" aria-label={`${label} persen`} />%
          </span>
        ) : (
          <span className="text-xs">({markup[k]}%)</span>
        )}
      </dt>
      <dd className="num">{rupiah(v)}</dd>
    </div>
  );
}

function DecisionModal({ open, onClose, id, onDone }: { open: boolean; onClose: () => void; id: string; onDone: () => void }) {
  const [f, setF] = useState({ decision: 'WON', startDate: today(), endDate: '', managerName: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const body: any = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      if (f.decision !== 'WON') { delete body.startDate; delete body.endDate; delete body.managerName; }
      await api(`/tenders/${id}/decision`, { body });
      toast.success(f.decision === 'WON' ? 'Selamat! Proyek & budget baseline sudah dibuat' : 'Hasil tender dicatat');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Catat hasil tender"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving}>Simpan hasil</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[['WON', 'Menang'], ['LOST', 'Kalah'], ['CANCELLED', 'Dibatalkan']].map(([v, l]) => (
            <button key={v} onClick={() => setF({ ...f, decision: v })} className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${f.decision === v ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink'}`}>{l}</button>
          ))}
        </div>
        {f.decision === 'WON' && (
          <>
            <p className="rounded-lg bg-signal-soft px-3 py-2.5 text-sm text-signal-ink">
              BQ akan disalin menjadi BQ kontrak (harga jual) dan budget baseline (harga biaya). Data tender tidak diubah.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mulai"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
              <Field label="Selesai"><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
              <Field label="Project manager" className="sm:col-span-2"><Input value={f.managerName} onChange={(e) => setF({ ...f, managerName: e.target.value })} /></Field>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
