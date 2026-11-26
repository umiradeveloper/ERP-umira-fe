'use client';

import { History, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_OPTIONS } from '@/lib/excel';
import { CATEGORY_LABEL, date, num, pct, rupiah, toNum } from '@/lib/format';
import { ExcelImport } from './excel-import';
import { Badge, Button, cn, Empty, ErrorBox, Field, Loading, Modal, Panel, Table, Td, Textarea, Th } from './ui';

type Row = {
  key: string;
  bqItemId: string | null;
  section: string;
  code: string;
  description: string;
  unit: string;
  category: string;
  quantity: string;
  unitRate: string;
};

let seq = 0;
const newKey = () => `r${++seq}`;
const amt = (r: { quantity: string; unitRate: string }) => Math.round(toNum(r.quantity) * toNum(r.unitRate) * 100) / 100;
const CATS = Object.keys(CATEGORY_LABEL).filter((c) => c !== 'TAX');

/**
 * RAP (Rencana Anggaran Pelaksanaan) disusun seperti RAB: bagian, kode, uraian, volume, harga satuan.
 * RAB (nilai kontrak) tampil di samping sebagai acuan. Disusun setelah tender menang, lalu ditetapkan.
 */
export function RapEditor({ projectId, canEdit, onSaved }: { projectId: string; canEdit: boolean; onSaved?: () => void }) {
  const { data, loading, error, reload } = useApi<any>(`/projects/${projectId}/rap`);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [recompute, setRecompute] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = can(user, 'admin:write');

  useEffect(() => {
    if (!data) return;
    setRows(
      (data.budget?.items ?? []).map((i: any) => ({
        key: newKey(), bqItemId: i.bqItemId, section: i.section ?? i.wbsCode ?? '', code: i.code ?? '', description: i.description,
        unit: i.unit ?? '', category: i.category, quantity: String(toNum(i.quantity)), unitRate: String(toNum(i.unitRate)),
      })),
    );
    setDirty(false);
  }, [data]);

  const rab = useMemo(() => new Map<string, any>((data?.rab ?? []).map((r: any) => [r.id, r])), [data]);
  const rabByCode = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of data?.rab ?? []) if (r.code && !m.has(String(r.code).trim())) m.set(String(r.code).trim(), r);
    return m;
  }, [data]);
  /** Acuan RAB sebuah baris RAP: tautan tersimpan bila kodenya masih sama, selain itu dicocokkan lewat Kode. */
  const linkOf = (r: Row): string | null => {
    const code = r.code.trim();
    const cur = r.bqItemId ? rab.get(r.bqItemId) : null;
    if (cur && (!code || String(cur.code ?? '').trim() === code)) return cur.id;
    return code ? rabByCode.get(code)?.id ?? null : null;
  };
  const missing = useMemo(() => (data?.rab ?? []).filter((r: any) => !rows.some((x) => linkOf(x) === r.id)), [data, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const rap = rows.reduce((a, r) => a + amt(r), 0);
    const rabTotal = (data?.rab ?? []).reduce((a: number, r: any) => a + toNum(r.amount), 0);
    return { rap, rab: rabTotal, selisih: rabTotal - rap, bkpu: rabTotal > 0 && rap > 0 ? (rap / rabTotal) * 100 : null };
  }, [rows, data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;

  const locked = data.locked;
  const editable = canEdit && !locked;

  const upd = (key: string, k: keyof Row, v: string) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: v } : r)));
    setDirty(true);
  };
  const addRow = () => {
    setRows((rs) => {
      const last = rs[rs.length - 1];
      return [...rs, { key: newKey(), bqItemId: null, section: last?.section ?? 'A. Pekerjaan Persiapan', code: '', description: '', unit: '', category: last?.category ?? 'MATERIAL', quantity: '0', unitRate: '0' }];
    });
    setDirty(true);
  };
  const removeRow = (key: string) => {
    setRows((rs) => rs.filter((x) => x.key !== key));
    setDirty(true);
  };
  const addMissing = () => {
    setRows((rs) => [
      ...rs,
      ...missing.map((r: any) => ({
        key: newKey(), bqItemId: r.id, section: r.section ?? '', code: r.code ?? '', description: r.description, unit: r.unit ?? '',
        category: r.category, quantity: String(toNum(r.quantity)), unitRate: String(toNum(r.estUnitCost)),
      })),
    ]);
    setDirty(true);
  };

  async function save() {
    const bad = rows.findIndex((r) => !r.description.trim());
    if (bad >= 0) return toast.error(`Baris ${bad + 1}: uraian wajib diisi`);
    setSaving(true);
    try {
      await api(`/projects/${projectId}/rap`, {
        method: 'PUT',
        body: {
          items: rows.map((r) => ({
            bqItemId: linkOf(r) || undefined, section: r.section, code: r.code, description: r.description, unit: r.unit,
            category: r.category, quantity: String(toNum(r.quantity)), unitRate: String(toNum(r.unitRate)),
          })),
        },
      });
      toast.success('RAP disimpan');
      reload();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setSaving(true);
    try {
      await api(`/projects/${projectId}/rap/approve`, { body: data?.isRevisionDraft ? { recomputeBkpu: recompute } : {} });
      toast.success(data?.isRevisionDraft ? `Revisi ${data.budget.revision} RAP ditetapkan dan menjadi budget pelaksanaan` : 'RAP ditetapkan dan menjadi budget pelaksanaan proyek');
      setConfirm(false);
      reload();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function revise() {
    setSaving(true);
    try {
      await api(`/projects/${projectId}/rap/revise`, { body: { reason: reason.trim() } });
      toast.success('Draf revisi RAP dibuat. RAP lama tetap berlaku sampai revisi ditetapkan.');
      setReviseOpen(false);
      setReason('');
      reload();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function cancelRevision() {
    setSaving(true);
    try {
      await api(`/projects/${projectId}/rap/revision`, { method: 'DELETE' });
      toast.success('Revisi dibatalkan, kembali ke RAP yang berlaku');
      setCancelOpen(false);
      reload();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Kelompokkan baris berurutan per bagian (urutan baris dipertahankan)
  const groups: { section: string; rows: Row[] }[] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g.section === r.section) g.rows.push(r);
    else groups.push({ section: r.section, rows: [r] });
  }
  const no = new Map(rows.map((r, i) => [r.key, i + 1]));
  // Satu item RAB bisa dirinci jadi beberapa baris RAP: jumlah & selisih RAB ditampilkan di baris pertama
  const links = new Map<string, string | null>(rows.map((r) => [r.key, linkOf(r)]));
  const linkSum = new Map<string, { first: string; sum: number; n: number }>();
  for (const r of rows) {
    const l = links.get(r.key);
    if (!l) continue;
    const e = linkSum.get(l);
    if (e) { e.sum += amt(r); e.n++; } else linkSum.set(l, { first: r.key, sum: amt(r), n: 1 });
  }
  const rabCell = (r: Row) => {
    const l = links.get(r.key);
    if (!l) return { rab: null as number | null, diff: null as number | null, sub: false };
    const e = linkSum.get(l)!;
    if (e.first !== r.key) return { rab: null, diff: null, sub: true };
    const v = toNum(rab.get(l)?.amount);
    return { rab: v, diff: v - e.sum, sub: false };
  };
  const sections = [...new Set([...rows.map((r) => r.section), ...(data.rab ?? []).map((r: any) => r.section)].filter(Boolean))];
  const field = 'h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-[13px] focus:border-ink focus:outline-none';


  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>*]:bg-surface [&>*]:px-5 [&>*]:py-4">
        <div>
          <div className="text-[13px] text-muted">Nilai kontrak (RAB)</div>
          <div className="num mt-1 text-[20px] font-semibold tracking-[-0.02em]">{rupiah(totals.rab)}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Budget pelaksanaan (RAP)</div>
          <div className="num mt-1 text-[20px] font-semibold tracking-[-0.02em]">{rupiah(totals.rap)}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">Selisih (RAB − RAP)</div>
          <div className={cn('num mt-1 text-[20px] font-semibold tracking-[-0.02em]', totals.selisih < 0 ? 'text-bad' : 'text-ok')}>{rupiah(totals.selisih)}</div>
        </div>
        <div>
          <div className="text-[13px] text-muted">BK/PU RAP (RAP ÷ RAB)</div>
          <div className={cn('num mt-1 text-[20px] font-semibold tracking-[-0.02em]', totals.bkpu !== null && totals.bkpu > 100 && 'text-bad')}>{totals.bkpu === null ? '—' : pct(totals.bkpu, 2)}</div>
        </div>
      </section>

      {data.isRevisionDraft && (
        <div className="rounded-xl border border-[#E8CDB8] bg-signal-soft px-5 py-3.5 text-sm text-signal-ink">
          <b>Revisi {data.budget.revision} sedang disusun.</b> Alasan: {data.revisions[0]?.revisionNote ?? '—'}. RAP yang berlaku saat ini revisi {data.current.revision} senilai{' '}
          <b className="num">{rupiah(data.current.total)}</b>; perubahan baru berlaku setelah revisi ditetapkan
          {toNum(data.current.total) !== totals.rap && <> (selisih <b className="num">{rupiah(totals.rap - toNum(data.current.total))}</b>)</>}.
        </div>
      )}

      <Panel
        title="RAP — Rencana Anggaran Pelaksanaan"
        subtitle={
          locked
            ? `${data.budget.revision > 1 ? `Revisi ${data.budget.revision} · ` : ''}Ditetapkan ${date(data.budget.approvedAt)}. ${isAdmin ? 'Ubah lewat tombol Revisi RAP atau Variation order.' : 'Perubahan lewat Revisi RAP (Administrator) atau Variation order.'}`
            : data.isRevisionDraft
              ? `Draf revisi ${data.budget.revision}. Edit seperti biasa lalu tetapkan; sampai itu cost control tetap memakai revisi ${data.current.revision}.`
              : 'Isi seperti RAB: unggah Excel atau tambah baris. Baris dengan Kode yang sama dengan RAB otomatis dibandingkan dengan RAB.'
        }
        bodyClass="p-0"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {locked ? <Badge label={data.budget.revision > 1 ? `Ditetapkan · rev ${data.budget.revision}` : 'Ditetapkan'} tone="ok" /> : <Badge label={data.isRevisionDraft ? `Draf revisi ${data.budget.revision}` : 'Draf'} tone="warn" />}
            {locked && isAdmin && <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setReviseOpen(true)}>Revisi RAP</Button>}
            {data.isRevisionDraft && isAdmin && <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>Batalkan revisi</Button>}
            {editable && (
              <>
                <ExcelImport
                  title="Impor RAP dari Excel"
                  templateName={`template-rap-${projectId.slice(0, 8)}`}
                  modes
                  hint="Formatnya sama dengan template RAB, jadi file RAB/RAP Anda bisa langsung diunggah. Template berisi RAP saat ini; ubah/tambah baris lalu pilih 'Ganti semua baris'. Kolom abu-abu (acuan RAB) hanya informasi."
                  columns={[
                    { key: 'section', header: 'Bagian', required: true, width: 28, note: 'mis. A. Pekerjaan Persiapan' },
                    { key: 'code', header: 'Kode', width: 10, note: 'Samakan dengan Kode di RAB agar otomatis dibandingkan' },
                    { key: 'description', header: 'Uraian', required: true, width: 42 },
                    { key: 'unit', header: 'Satuan', width: 10 },
                    { key: 'category', header: 'Kategori', type: 'enum', options: CATEGORY_OPTIONS },
                    { key: 'quantity', header: 'Volume', type: 'number', required: true },
                    { key: 'unitRate', header: 'Harga satuan', type: 'number', required: true, width: 18 },
                    { key: 'rabQty', header: 'Volume RAB (acuan)', type: 'number', readOnly: true, width: 18 },
                    { key: 'rabPrice', header: 'Harga satuan RAB (acuan)', type: 'number', readOnly: true, width: 22 },
                  ]}
                  prefill={() => {
                    const base = rows.length
                      ? rows
                      : (data.rab ?? []).map((r: any) => ({ key: '', bqItemId: r.id, section: r.section, code: r.code ?? '', description: r.description, unit: r.unit ?? '', category: r.category, quantity: String(toNum(r.quantity)), unitRate: String(toNum(r.estUnitCost)) }));
                    return base.map((r: Row) => {
                      const b = (r.bqItemId && rab.get(r.bqItemId)) || (r.code ? rabByCode.get(r.code.trim()) : null);
                      return { section: r.section, code: r.code, description: r.description, unit: r.unit, category: r.category, quantity: r.quantity, unitRate: r.unitRate, rabQty: b ? String(toNum(b.quantity)) : '', rabPrice: b ? String(toNum(b.unitPrice)) : '' };
                    });
                  }}
                  onApply={(xs, mode) => {
                    const add: Row[] = xs.map((x) => ({
                      key: newKey(), bqItemId: x.code ? rabByCode.get(String(x.code).trim())?.id ?? null : null,
                      section: x.section, code: x.code ?? '', description: x.description, unit: x.unit ?? '',
                      category: x.category || 'MATERIAL', quantity: x.quantity || '0', unitRate: x.unitRate || '0',
                    }));
                    setRows(mode === 'replace' ? add : [...rows, ...add]);
                    setDirty(true);
                  }}
                />
                <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={addRow}>Tambah baris</Button>
                <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>Simpan RAP</Button>
                {(!data.isRevisionDraft || isAdmin) && (
                  <Button size="sm" variant="secondary" icon={<Lock className="size-3.5" />} disabled={dirty || !rows.length} onClick={() => setConfirm(true)}>{data.isRevisionDraft ? 'Tetapkan revisi' : 'Tetapkan RAP'}</Button>
                )}
              </>
            )}
          </div>
        }
      >
        {editable && missing.length > 0 && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-signal-soft px-5 py-2.5 text-sm text-signal-ink">
            {missing.length} item RAB belum punya baris RAP (dicocokkan lewat Kode).
            <Button size="sm" variant="secondary" onClick={addMissing}>Tambahkan dari RAB</Button>
          </div>
        )}
        {!rows.length ? (
          <Empty title="RAP belum disusun">
            <p>Unggah Excel RAP (format sama dengan RAB) atau klik &quot;Tambah baris&quot;.</p>
            {editable && data.rab?.length > 0 && (
              <div className="mt-3"><Button size="sm" variant="secondary" onClick={addMissing}>Salin struktur dari RAB</Button></div>
            )}
          </Empty>
        ) : editable ? (
          <Table minWidth={1500}>
            <thead>
              <tr>
                <Th className="w-44">Bagian</Th>
                <Th className="w-20">Kode</Th>
                <Th className="min-w-[260px]">Uraian</Th>
                <Th className="w-20">Sat.</Th>
                <Th className="w-36">Kategori</Th>
                <Th right className="w-28">Volume</Th>
                <Th right className="w-36">Harga satuan</Th>
                <Th right className="w-40">Jumlah RAP</Th>
                <Th right className="w-40 bg-canvas/60">Jumlah RAB</Th>
                <Th right className="w-36">Selisih</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = rabCell(r);
                return (
                  <tr key={r.key} className="[&>td]:border-b [&>td]:border-line [&>td]:px-1.5 [&>td]:py-1.5 [&>td:first-child]:pl-4">
                    <td><input className={field} value={r.section} list="rap-sections" onChange={(e) => upd(r.key, 'section', e.target.value)} /></td>
                    <td><input className={field} value={r.code} onChange={(e) => upd(r.key, 'code', e.target.value)} /></td>
                    <td><input className={field} value={r.description} placeholder="Uraian pekerjaan / biaya" onChange={(e) => upd(r.key, 'description', e.target.value)} /></td>
                    <td><input className={field} value={r.unit} onChange={(e) => upd(r.key, 'unit', e.target.value)} /></td>
                    <td>
                      <select className={field} value={r.category} onChange={(e) => upd(r.key, 'category', e.target.value)}>
                        {CATS.map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}
                      </select>
                    </td>
                    <td><input type="number" step="any" min={0} className={cn(field, 'num text-right')} value={r.quantity} onChange={(e) => upd(r.key, 'quantity', e.target.value)} /></td>
                    <td><input type="number" step="any" min={0} className={cn(field, 'num text-right')} value={r.unitRate} onChange={(e) => upd(r.key, 'unitRate', e.target.value)} /></td>
                    <td className="num whitespace-nowrap pr-3 text-right text-[13px] font-medium">{rupiah(amt(r))}</td>
                    <td className="num whitespace-nowrap bg-canvas/40 pr-3 text-right text-[13px] text-muted">{c.rab !== null ? rupiah(c.rab) : c.sub ? '↳' : '—'}</td>
                    <td className={cn('num whitespace-nowrap pr-3 text-right text-[13px]', c.diff !== null && c.diff < 0 ? 'text-bad' : 'text-muted')}>{c.diff !== null ? rupiah(c.diff) : ''}</td>
                    <td>
                      <button type="button" title="Hapus baris" onClick={() => removeRow(r.key)} className="rounded p-1 text-faint hover:bg-bad-soft hover:text-bad">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-hover font-semibold">
                <Td colSpan={7}>Total</Td>
                <Td right>{rupiah(totals.rap)}</Td>
                <Td right>{rupiah(totals.rab)}</Td>
                <Td right className={totals.selisih < 0 ? 'text-bad' : 'text-ok'}>{rupiah(totals.selisih)}</Td>
                <Td />
              </tr>
            </tbody>
          </Table>
        ) : (
          <Table minWidth={1200}>
            <thead>
              <tr>
                <Th className="w-10">No</Th>
                <Th className="w-20">Kode</Th>
                <Th className="min-w-[240px]">Uraian</Th>
                <Th className="w-16">Sat.</Th>
                <Th className="w-32">Kategori</Th>
                <Th right>Volume</Th>
                <Th right>Harga satuan</Th>
                <Th right>Jumlah RAP</Th>
                <Th right className="bg-canvas/60">Jumlah RAB</Th>
                <Th right>Selisih</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => {
                const subRap = g.rows.reduce((a, r) => a + amt(r), 0);
                const subRab = g.rows.reduce((a, r) => a + (rabCell(r).rab ?? 0), 0);
                return [
                  <tr key={`h${gi}`} className="bg-canvas/60">
                    <Td colSpan={7} className="font-semibold text-ink">{g.section || 'Tanpa bagian'}</Td>
                    <Td right className="font-semibold">{rupiah(subRap)}</Td>
                    <Td right className="font-semibold">{subRab ? rupiah(subRab) : ''}</Td>
                    <Td right className={cn('font-semibold', subRab - subRap < 0 ? 'text-bad' : '')}>{subRab ? rupiah(subRab - subRap) : ''}</Td>
                  </tr>,
                  ...g.rows.map((r) => {
                    const c = rabCell(r);
                    return (
                      <tr key={r.key} className="border-t border-line">
                        <Td className="text-muted">{no.get(r.key)}</Td>
                        <Td className="text-muted">{r.code}</Td>
                        <Td>{r.description}</Td>
                        <Td className="text-muted">{r.unit}</Td>
                        <Td className="text-muted">{CATEGORY_LABEL[r.category]}</Td>
                        <Td right>{num(r.quantity, 6)}</Td>
                        <Td right>{rupiah(r.unitRate)}</Td>
                        <Td right className="font-medium">{rupiah(amt(r))}</Td>
                        <Td right className="bg-canvas/40 text-muted">{c.rab !== null ? rupiah(c.rab) : c.sub ? '↳' : '—'}</Td>
                        <Td right className={cn(c.diff !== null && c.diff < 0 ? 'text-bad' : 'text-muted')}>{c.diff !== null ? rupiah(c.diff) : ''}</Td>
                      </tr>
                    );
                  }),
                ];
              })}
              <tr className="border-t-2 border-line-strong bg-hover font-semibold">
                <Td colSpan={7}>Total</Td>
                <Td right>{rupiah(totals.rap)}</Td>
                <Td right>{rupiah(totals.rab)}</Td>
                <Td right className={totals.selisih < 0 ? 'text-bad' : 'text-ok'}>{rupiah(totals.selisih)}</Td>
              </tr>
            </tbody>
          </Table>
        )}
        <datalist id="rap-sections">{sections.map((x) => <option key={x} value={x} />)}</datalist>
        {dirty && <p className="border-t border-line px-5 py-2.5 text-xs text-warn">Ada perubahan RAP yang belum disimpan.</p>}
      </Panel>

      {data.revisions?.length > 1 && (
        <Panel title={<span className="flex items-center gap-2"><History className="size-4" /> Riwayat revisi RAP</span>} bodyClass="p-0">
          <Table>
            <thead><tr><Th>Revisi</Th><Th>Status</Th><Th>Alasan</Th><Th>Dibuat</Th><Th>Ditetapkan</Th><Th right>Total RAP</Th><Th right>Perubahan</Th></tr></thead>
            <tbody>
              {data.revisions.map((r: any, i: number) => {
                const prev = data.revisions[i + 1];
                const d = prev ? toNum(r.total) - toNum(prev.total) : null;
                return (
                  <tr key={r.id} className="border-t border-line">
                    <Td className="whitespace-nowrap font-medium">{r.revision === 1 ? 'Awal' : `Rev ${r.revision}`}</Td>
                    <Td>{r.approvedAt ? (data.current?.revision === r.revision ? <Badge label="Berlaku" tone="ok" /> : <Badge label="Diganti" tone="neutral" />) : <Badge label="Draf" tone="warn" />}</Td>
                    <Td className="min-w-[220px] max-w-[360px]"><span className="line-clamp-2" title={r.revisionNote ?? undefined}>{r.revisionNote ?? (r.name?.includes('VO-') ? `Variation order (${r.name.split('— ')[1] ?? ''})` : '—')}</span></Td>
                    <Td className="whitespace-nowrap text-muted">{date(r.createdAt)}{r.createdByName ? ` · ${r.createdByName}` : ''}</Td>
                    <Td className="whitespace-nowrap text-muted">{r.approvedAt ? `${date(r.approvedAt)}${r.approvedByName ? ` · ${r.approvedByName}` : ''}` : '—'}</Td>
                    <Td right>{rupiah(r.total)}</Td>
                    <Td right className={d !== null && d > 0 ? 'text-bad' : d !== null && d < 0 ? 'text-ok' : 'text-muted'}>{d === null ? '—' : `${d > 0 ? '+' : ''}${rupiah(d)}`}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title={data.isRevisionDraft ? `Tetapkan revisi ${data.budget?.revision}?` : 'Tetapkan RAP?'}
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Batal</Button><Button onClick={approve} loading={saving}>{data.isRevisionDraft ? 'Tetapkan revisi' : 'Tetapkan RAP'}</Button></>}>
        {data.isRevisionDraft ? (
          <div className="space-y-3 text-sm">
            <p>
              RAP revisi {data.budget?.revision} senilai <b className="num">{rupiah(totals.rap)}</b> menggantikan revisi {data.current?.revision} (<span className="num">{rupiah(data.current?.total)}</span>)
              sebagai budget pelaksanaan untuk cost control dan cek budget PR.
            </p>
            <label className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
              <input type="checkbox" className="mt-0.5 accent-[#0A4152]" checked={recompute} onChange={(e) => setRecompute(e.target.checked)} />
              <span>
                <b>Hitung ulang BK/PU penetapan</b> menjadi <span className="num">{totals.bkpu === null ? '—' : pct(totals.bkpu, 2)}</span>.
                <span className="block text-xs text-muted">Biarkan tidak dicentang agar efisiensi tetap diukur terhadap BK/PU awal.</span>
              </span>
            </label>
          </div>
        ) : (
          <p className="text-sm">
            RAP senilai <b className="num">{rupiah(totals.rap)}</b> akan menjadi budget pelaksanaan proyek dan dipakai untuk cost control dan cek budget PR.
            <b> BK/PU penetapan</b> proyek otomatis diisi <b className="num">{totals.bkpu === null ? '—' : pct(totals.bkpu, 2)}</b> (RAP ÷ RAB) sebagai BK/PU awal.
            Setelah ditetapkan RAP terkunci; perubahan berikutnya lewat Revisi RAP (Administrator) atau Variation order.
          </p>
        )}
      </Modal>

      <Modal open={reviseOpen} onClose={() => setReviseOpen(false)} title="Revisi RAP"
        footer={<><Button variant="secondary" onClick={() => setReviseOpen(false)}>Batal</Button><Button onClick={revise} loading={saving} disabled={reason.trim().length < 5}>Buat draf revisi</Button></>}>
        <div className="space-y-4 text-sm">
          <p>
            RAP yang berlaku disalin menjadi <b>draf revisi {(data.budget?.revision ?? 1) + 1}</b> yang bisa diedit (tambah/ubah baris atau impor Excel).
            Sampai revisi ditetapkan, cost control tetap memakai RAP saat ini. Riwayat revisi dan alasannya tersimpan di audit log.
          </p>
          <Field label="Alasan revisi" hint="Wajib, minimal 5 karakter. Mis. koreksi salah input harga beton, perubahan metode kerja.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <p className="text-xs text-muted">Untuk pekerjaan tambah/kurang yang mengubah nilai kontrak, gunakan Variation order.</p>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Batalkan revisi RAP?"
        footer={<><Button variant="secondary" onClick={() => setCancelOpen(false)}>Tidak</Button><Button variant="danger" onClick={cancelRevision} loading={saving}>Batalkan revisi</Button></>}>
        <p className="text-sm">Draf revisi {data.budget?.revision} dan semua perubahannya dihapus. RAP kembali ke revisi {data.current?.revision} yang berlaku.</p>
      </Modal>
    </div>
  );
}
