'use client';

import { ExcelImport } from '@/components/excel-import';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { Attachments } from '@/components/attachments';
import { Badge, Button, cn, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, Panel, Textarea } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, num, rupiah, today, toNum } from '@/lib/format';

export default function RfqDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const { data: r, error, loading, reload } = useApi<any>(`/rfqs/${id}`);
  const [quoteFor, setQuoteFor] = useState<string | null>(null);
  const [award, setAward] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);

  if (loading && !r) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!r) return null;
  const w = can(user, 'procurement:write') && r.status === 'OPEN';
  const cmp = r.comparison;
  const quoteOf = (sid: string) => cmp.quotes.find((q: any) => q.supplierId === sid);
  const est = toNum(r.request?.totalEstimate);

  return (
    <div className="animate-rise">
      <PageHeader
        back={{ href: '/procurement/rfq', label: 'RFQ & penawaran' }}
        title={r.number}
        description={<span className="flex flex-wrap items-center gap-2">{r.title}</span>}
        actions={
          <>
            {w && <Button variant="secondary" onClick={() => setInvite(true)}>Atur supplier</Button>}
            {w && <Button variant="ghost" onClick={() => api(`/rfqs/${id}/cancel`, { body: {} }).then(() => { toast.success('RFQ dibatalkan'); reload(); }).catch((e) => toast.error(e.message))}>Batalkan RFQ</Button>}
            {r.poId && <Link href={`/procurement/po/${r.poId}`} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white">Buka PO</Link>}
          </>
        }
      />

      <Panel className="mb-6">
        <KV cols={4} items={[
          ['Proyek', r.project ? `${r.project.code} — ${r.project.name}` : '—'],
          ['Dari PR', r.request ? <Link key="pr" href={`/procurement/pr/${r.request.id}`} className="hover:underline underline-offset-2">{r.request.number}</Link> : '—'],
          ['Batas penawaran', date(r.dueDate)],
          ['Estimasi PR', rupiah(est)],
        ]} />
        {r.status === 'AWARDED' && r.awardReason && <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-2">Alasan pemilihan: {r.awardReason}</p>}
      </Panel>

      {/* Matriks perbandingan */}
      <section className="mb-6 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 300 + r.suppliers.length * 190 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[300px] border-b border-line bg-surface px-5 py-4 text-left align-bottom">
                <div className="text-[15px] font-semibold">Perbandingan penawaran</div>
                <div className="text-xs font-normal text-muted">Harga terendah per item ditandai</div>
              </th>
              {r.suppliers.map((s: any) => {
                const q = quoteOf(s.supplierId);
                const winner = r.awardedSupplierId === s.supplierId;
                return (
                  <th key={s.supplierId} className={cn('border-b border-l border-line px-4 py-4 text-left align-bottom font-normal', winner && 'bg-signal-soft')}>
                    <div className="font-semibold text-ink">{s.supplier.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!q && <Badge label="Belum menawar" tone="neutral" />}
                      {q && cmp.lowestSupplierId === s.supplierId && <Badge label="Termurah" tone="ok" />}
                      {q && cmp.fastestSupplierId === s.supplierId && <Badge label="Tercepat" tone="info" />}
                      {q && !q.complete && <Badge label="Tidak lengkap" tone="warn" />}
                      {winner && <Badge label="Pemenang" tone="ok" />}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {r.items.map((i: any) => (
              <tr key={i.id}>
                <td className="sticky left-0 z-10 border-b border-line bg-surface px-5 py-3">
                  <div className="font-medium">{i.description}</div>
                  <div className="num text-xs text-muted">{num(i.quantity)} {i.unit}</div>
                </td>
                {r.suppliers.map((s: any) => {
                  const p = quoteOf(s.supplierId)?.prices[i.id];
                  return (
                    <td key={s.supplierId} className={cn('num border-b border-l border-line px-4 py-3 text-right', r.awardedSupplierId === s.supplierId && 'bg-signal-soft/50')}>
                      {p ? (
                        <>
                          <div className={cn(p.lowest && 'font-semibold text-ok')}>{rupiah(p.unitPrice)}</div>
                          <div className="text-xs text-muted">{rupiah(p.amount)}</div>
                        </>
                      ) : <span className="text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {[
              ['Subtotal', (q: any) => <span className="font-semibold">{rupiah(q.subtotal)}</span>],
              ['Selisih vs estimasi PR', (q: any) => { const d = toNum(q.subtotal) - est; return <span className={d > 0 ? 'text-bad' : 'text-ok'}>{d > 0 ? '+' : '−'}{rupiah(Math.abs(d))}</span>; }],
              ['Lead time', (q: any) => `${q.leadTimeDays} hari`],
              ['Termin bayar', (q: any) => `${q.paymentTerm} hari`],
              ['Berlaku sampai', (q: any) => date(q.validUntil)],
            ].map(([label, fn]: any) => (
              <tr key={label} className="bg-hover/60">
                <td className="sticky left-0 z-10 border-b border-line bg-hover px-5 py-2.5 text-[13px] font-medium text-ink-2">{label}</td>
                {r.suppliers.map((s: any) => {
                  const q = quoteOf(s.supplierId);
                  return <td key={s.supplierId} className="num border-b border-l border-line px-4 py-2.5 text-right text-[13px]">{q ? fn(q) : <span className="text-faint">—</span>}</td>;
                })}
              </tr>
            ))}
            {w && (
              <tr>
                <td className="sticky left-0 z-10 bg-surface px-5 py-3" />
                {r.suppliers.map((s: any) => {
                  const q = quoteOf(s.supplierId);
                  return (
                    <td key={s.supplierId} className="border-l border-line px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setQuoteFor(s.supplierId)}>{q ? 'Ubah penawaran' : 'Input penawaran'}</Button>
                        {q?.complete && <Button size="sm" onClick={() => setAward(s.supplierId)}>Pilih & buat PO</Button>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Attachments entityType="Rfq" entityId={id} title="Dokumen penawaran" canUpload={can(user, 'procurement:write')} />

      {quoteFor && <QuoteModal rfq={r} supplierId={quoteFor} onClose={() => setQuoteFor(null)} onDone={reload} />}
      {award && <AwardModal rfq={r} supplierId={award} onClose={() => setAward(null)} onDone={(poId) => router.push(`/procurement/po/${poId}`)} />}
      {invite && <InviteModal rfq={r} onClose={() => setInvite(false)} onDone={reload} />}
    </div>
  );
}

function QuoteModal({ rfq, supplierId, onClose, onDone }: { rfq: any; supplierId: string; onClose: () => void; onDone: () => void }) {
  const existing = rfq.quotations.find((q: any) => q.supplierId === supplierId);
  const name = rfq.suppliers.find((s: any) => s.supplierId === supplierId)?.supplier.name;
  const [f, setF] = useState({
    quoteRef: existing?.quoteRef ?? '', quoteDate: existing?.quoteDate?.slice(0, 10) ?? today(), leadTimeDays: String(existing?.leadTimeDays ?? 7),
    paymentTerm: String(existing?.paymentTerm ?? 30), validUntil: existing?.validUntil?.slice(0, 10) ?? '', notes: existing?.notes ?? '',
  });
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(rfq.items.map((i: any) => [i.id, String(toNum(existing?.lines.find((l: any) => l.rfqItemId === i.id)?.unitPrice) || '')])),
  );
  const [saving, setSaving] = useState(false);
  const total = rfq.items.reduce((a: number, i: any) => a + toNum(prices[i.id]) * toNum(i.quantity), 0);
  async function save() {
    setSaving(true);
    try {
      await api(`/rfqs/${rfq.id}/quotations`, {
        body: {
          supplierId, ...f, quoteRef: f.quoteRef || undefined, validUntil: f.validUntil || undefined, notes: f.notes || undefined,
          leadTimeDays: Number(f.leadTimeDays), paymentTerm: Number(f.paymentTerm),
          lines: Object.entries(prices).filter(([, v]) => toNum(v) > 0).map(([rfqItemId, unitPrice]) => ({ rfqItemId, unitPrice })),
        },
      });
      toast.success('Penawaran tersimpan');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={`Penawaran ${name}`} wide footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving}>Simpan penawaran</Button></>}>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Field label="No. penawaran"><Input value={f.quoteRef} onChange={set('quoteRef')} /></Field>
        <Field label="Tanggal"><Input type="date" value={f.quoteDate} onChange={set('quoteDate')} /></Field>
        <Field label="Berlaku sampai"><Input type="date" value={f.validUntil} onChange={set('validUntil')} /></Field>
        <Field label="Lead time (hari)"><Input type="number" value={f.leadTimeDays} onChange={set('leadTimeDays')} /></Field>
        <Field label="Termin bayar (hari)"><Input type="number" value={f.paymentTerm} onChange={set('paymentTerm')} /></Field>
        <Field label="Catatan"><Input value={f.notes} onChange={set('notes')} /></Field>
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        {rfq.items.map((i: any) => (
          <div key={i.id} className="grid grid-cols-[1fr_160px_150px] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
            <div><div className="text-sm font-medium">{i.description}</div><div className="num text-xs text-muted">{num(i.quantity)} {i.unit}</div></div>
            <Input type="number" className="h-9" placeholder="Harga satuan" value={prices[i.id]} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} aria-label={`Harga ${i.description}`} />
            <div className="num text-right text-sm">{rupiah(toNum(prices[i.id]) * toNum(i.quantity))}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ExcelImport
          title={`Impor harga penawaran ${name ?? ''}`}
          templateName={`penawaran-${rfq.number}-${(name ?? 'supplier').replace(/\W+/g, '-')}`}
          hint="Template berisi daftar item RFQ. Cukup isi kolom Harga satuan."
          columns={[
            { key: 'no', header: 'No', type: 'integer', readOnly: true, width: 6 },
            { key: 'description', header: 'Uraian', readOnly: true, width: 40 },
            { key: 'quantity', header: 'Volume', type: 'number', readOnly: true },
            { key: 'unit', header: 'Satuan', readOnly: true, width: 10 },
            { key: 'unitPrice', header: 'Harga satuan', type: 'number', required: true, width: 18 },
          ]}
          prefill={rfq.items.map((i: any, k: number) => ({ no: String(k + 1), description: i.description, quantity: String(toNum(i.quantity)), unit: i.unit ?? '', unitPrice: prices[i.id] ?? '' }))}
          resolve={(r) => {
            const it = rfq.items[Number(r.no) - 1] ?? rfq.items.find((i: any) => i.description.trim().toLowerCase() === (r.description ?? '').trim().toLowerCase());
            return it ? { ...r, itemId: it.id } : r.no || r.description ? `item "${r.no || r.description}" tidak ada di RFQ` : 'kolom No/Uraian kosong — gunakan baris dari template';
          }}
          onApply={(rows) => setPrices({ ...prices, ...Object.fromEntries(rows.map((r) => [r.itemId, r.unitPrice])) })}
        />
        <div className="text-sm">Subtotal <span className="num ml-2 font-semibold">{rupiah(total)}</span></div>
      </div>
    </Modal>
  );
}

function AwardModal({ rfq, supplierId, onClose, onDone }: { rfq: any; supplierId: string; onClose: () => void; onDone: (poId: string) => void }) {
  const q = rfq.comparison.quotes.find((x: any) => x.supplierId === supplierId);
  const lowest = rfq.comparison.lowestSupplierId === supplierId;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const r = await api(`/rfqs/${rfq.id}/award`, { body: { supplierId, reason: reason || undefined } });
      toast.success(`${r.poNumber} dibuat sebagai draft — ajukan approval dari halaman PO`);
      onDone(r.poId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Pilih ${q.supplierName}`} footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!lowest && !reason.trim()}>Pilih & buat draft PO</Button></>}>
      <p className="text-sm text-ink-2">Subtotal <span className="num font-semibold">{rupiah(q.subtotal)}</span>, lead time {q.leadTimeDays} hari, termin {q.paymentTerm} hari. Draft PO dibuat dengan harga dari penawaran ini.</p>
      {!lowest && (
        <Field label="Alasan memilih supplier yang bukan termurah (wajib)" className="mt-4">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. lead time lebih cepat sesuai jadwal pengecoran" autoFocus />
        </Field>
      )}
    </Modal>
  );
}

function InviteModal({ rfq, onClose, onDone }: { rfq: any; onClose: () => void; onDone: () => void }) {
  const { data: suppliers } = useApi<any[]>('/suppliers');
  const [ids, setIds] = useState<string[]>(rfq.suppliers.map((s: any) => s.supplierId));
  const quoted = new Set(rfq.quotations.map((q: any) => q.supplierId));
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api(`/rfqs/${rfq.id}/suppliers`, { method: 'PUT', body: { supplierIds: ids } });
      toast.success('Daftar supplier diperbarui');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Supplier yang diundang" footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!ids.length}>Simpan</Button></>}>
      <div className="space-y-2">
        {suppliers?.map((s) => (
          <label key={s.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 has-[:checked]:border-ink">
            <input type="checkbox" className="accent-[#0A4152]" disabled={quoted.has(s.id)} checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} />
            <span className="flex-1 text-sm font-medium">{s.name}</span>
            <span className="text-xs text-muted">{quoted.has(s.id) ? 'Sudah menawar' : s.category}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
