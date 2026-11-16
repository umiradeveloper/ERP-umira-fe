'use client';

import { ExcelImport } from '@/components/excel-import';
import Link from 'next/link';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { ApprovalTimeline } from '@/components/approval-timeline';
import { Attachments } from '@/components/attachments';
import { ExportButton } from '@/components/export-button';
import { Badge, Button, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, Panel, Select, Table, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABEL, date, num, rupiah, today, toNum } from '@/lib/format';

export default function PoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: po, error, loading, reload } = useApi<any>(`/purchase-orders/${id}`);
  const [busy, setBusy] = useState('');
  const [grn, setGrn] = useState(false);
  const [inv, setInv] = useState(false);

  if (loading && !po) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!po) return null;
  const w = can(user, 'procurement:write');

  async function act(key: string, path: string, msg: string) {
    setBusy(key);
    try {
      const r = await api(path, { body: {} });
      toast.success(r?.status === 'APPROVED' ? 'PO disetujui otomatis' : msg);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }
  const receivedPct = po.items.reduce((a: number, i: any) => a + toNum(i.receivedQty) * toNum(i.unitPrice), 0) / Math.max(1, toNum(po.subtotal)) * 100;

  return (
    <div className="animate-rise">
      <PageHeader
        back={{ href: '/procurement/po', label: 'Purchase order' }}
        title={po.number}
        description={<span className="flex items-center gap-2"><Badge status={po.status} /> {po.supplier.name}</span>}
        actions={
          <>
            <ExportButton path={`/documents/purchase-orders/${id}.pdf`} label="PDF" kind="pdf" />
            {po.status === 'DRAFT' && w && <Button loading={busy === 's'} onClick={() => act('s', `/purchase-orders/${id}/submit`, 'PO diajukan untuk approval')}>Ajukan approval</Button>}
            {po.status === 'APPROVED' && w && <Button loading={busy === 'i'} onClick={() => act('i', `/purchase-orders/${id}/issue`, 'PO diterbitkan ke supplier')}>Terbitkan ke supplier</Button>}
            {['ISSUED', 'PARTIAL_RECEIPT'].includes(po.status) && (w || can(user, 'warehouse:write')) && <Button onClick={() => setGrn(true)}>Terima barang</Button>}
            {['ISSUED', 'PARTIAL_RECEIPT', 'RECEIVED'].includes(po.status) && can(user, 'finance:write') && <Button variant="secondary" onClick={() => setInv(true)}>Catat invoice supplier</Button>}
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel>
            <KV cols={4} items={[
              ['Proyek', <Link key="p" href={`/projects/${po.projectId}`} className="underline-offset-2 hover:underline">{po.project.code}</Link>],
              ['Dari PR', po.request ? <Link key="r" href={`/procurement/pr/${po.request.id}`} className="underline-offset-2 hover:underline">{po.request.number}</Link> : 'Manual'],
              ['Tanggal kirim', date(po.deliveryDate)],
              ['Barang diterima', `${Math.round(receivedPct)}%`],
            ]} />
          </Panel>

          <Panel title="Item" bodyClass="p-0">
            <Table>
              <thead><tr><Th>Uraian</Th><Th>Kategori</Th><Th right>Dipesan</Th><Th right>Diterima</Th><Th right>Ditagih</Th><Th right>Harga</Th><Th right>Jumlah</Th></tr></thead>
              <tbody>
                {po.items.map((i: any) => (
                  <Tr key={i.id}>
                    <Td className="font-medium">{i.description}</Td>
                    <Td className="text-muted">{CATEGORY_LABEL[i.category]}</Td>
                    <Td right>{num(i.quantity)} <span className="text-muted">{i.unit}</span></Td>
                    <Td right className={toNum(i.receivedQty) >= toNum(i.quantity) ? 'text-ok' : ''}>{num(i.receivedQty)}</Td>
                    <Td right>{num(i.invoicedQty)}</Td>
                    <Td right>{rupiah(i.unitPrice)}</Td>
                    <Td right>{rupiah(i.amount)}</Td>
                  </Tr>
                ))}
                <tr><Td colSpan={6} className="text-right text-muted">Subtotal</Td><Td right>{rupiah(po.subtotal)}</Td></tr>
                <tr><Td colSpan={6} className="text-right text-muted">PPN {num(po.taxPct)}%</Td><Td right>{rupiah(po.taxAmount)}</Td></tr>
                <tr className="font-semibold"><Td colSpan={6} className="text-right">Total</Td><Td right>{rupiah(po.total)}</Td></tr>
              </tbody>
            </Table>
          </Panel>

          <Panel title="Penerimaan barang" bodyClass="p-0">
            {po.goodsReceipts.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Belum ada penerimaan.</p> : (
              <Table>
                <thead><tr><Th>Nomor</Th><Th>Tanggal</Th><Th>Catatan</Th><Th right>Baris</Th></tr></thead>
                <tbody>{po.goodsReceipts.map((g: any) => <Tr key={g.id}><Td className="font-medium">{g.number}</Td><Td>{date(g.receiptDate)}</Td><Td className="text-muted">{g.notes}</Td><Td right>{g.lines.length}</Td></Tr>)}</tbody>
              </Table>
            )}
          </Panel>

          <Panel title="Invoice supplier" bodyClass="p-0">
            {po.invoices.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Belum ada invoice.</p> : (
              <Table>
                <thead><tr><Th>Nomor</Th><Th>No. supplier</Th><Th>Hasil 3-way match</Th><Th right>Total</Th><Th>Status</Th></tr></thead>
                <tbody>{po.invoices.map((i: any) => <Tr key={i.id} href="/finance/ap"><Td className="font-medium">{i.number}</Td><Td>{i.supplierRef}</Td><Td className="max-w-xs text-xs text-muted">{i.matchNotes}</Td><Td right>{rupiah(i.total)}</Td><Td><Badge status={i.status} /></Td></Tr>)}</tbody>
              </Table>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <ApprovalTimeline entityType="PO" entityId={id} refreshKey={po.status} />
          <Attachments entityType="PurchaseOrder" entityId={id} title="Lampiran (quotation, surat jalan, foto)" canUpload={w || can(user, 'warehouse:write')} />
        </div>
      </div>

      {grn && <GrnModal po={po} onClose={() => setGrn(false)} onDone={reload} />}
      {inv && <InvoiceModal po={po} onClose={() => setInv(false)} onDone={reload} />}
    </div>
  );
}

function GrnModal({ po, onClose, onDone }: { po: any; onClose: () => void; onDone: () => void }) {
  const { data: warehouses } = useApi<any[]>('/warehouses');
  const [warehouseId, setWarehouseId] = useState('');
  const [receiptDate, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(po.items.map((i: any) => [i.id, String(toNum(i.quantity) - toNum(i.receivedQty))])));
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const g = await api('/goods-receipts', { body: { poId: po.id, receiptDate, warehouseId: warehouseId || undefined, notes: notes || undefined, lines: Object.entries(qty).map(([poItemId, quantity]) => ({ poItemId, quantity: quantity || '0' })) } });
      toast.success(`${g.number} tercatat`);
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Terima barang — ${po.number}`} wide footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving}>Simpan penerimaan</Button></>}>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Field label="Tanggal terima"><Input type="date" value={receiptDate} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Masuk ke gudang" hint="Kosongkan jika langsung dipakai di lapangan">
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">Langsung pakai (tanpa stok)</option>
            {warehouses?.filter((wh) => wh.isActive).sort((a, b) => (a.projectId === po.projectId ? -1 : b.projectId === po.projectId ? 1 : 0)).map((wh) => <option key={wh.id} value={wh.id}>{wh.code} — {wh.name}</option>)}
          </Select>
        </Field>
        <Field label="Catatan / kondisi" className="sm:col-span-3"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. diterima baik, 2 sak rusak" /></Field>
      </div>
      <Table>
        <thead><tr><Th>Item</Th><Th right>Sisa</Th><Th right className="w-36">Diterima sekarang</Th></tr></thead>
        <tbody>
          {po.items.map((i: any) => (
            <tr key={i.id} className="[&>td]:border-b [&>td]:border-line">
              <Td>{i.description}</Td>
              <Td right>{num(toNum(i.quantity) - toNum(i.receivedQty))} {i.unit}</Td>
              <td className="py-1.5"><Input type="number" className="h-8" value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Penerimaan parsial diperbolehkan. Kuantitas tidak boleh melebihi sisa PO.</p>
        <ExcelImport
          title={`Impor penerimaan ${po.number}`}
          templateName={`penerimaan-${po.number}`}
          hint="Template berisi item PO dan sisanya. Isi kolom Diterima."
          columns={[
            { key: 'no', header: 'No', type: 'integer', readOnly: true, width: 6 },
            { key: 'description', header: 'Uraian', readOnly: true, width: 40 },
            { key: 'remaining', header: 'Sisa', type: 'number', readOnly: true },
            { key: 'unit', header: 'Satuan', readOnly: true, width: 10 },
            { key: 'quantity', header: 'Diterima', type: 'number', required: true },
          ]}
          prefill={po.items.map((i: any, k: number) => ({ no: String(k + 1), description: i.description, remaining: String(toNum(i.quantity) - toNum(i.receivedQty)), unit: i.unit ?? '', quantity: '' }))}
          resolve={(r) => {
            const it = po.items[Number(r.no) - 1] ?? po.items.find((i: any) => i.description.trim().toLowerCase() === (r.description ?? '').trim().toLowerCase());
            if (!it) return r.no || r.description ? `item "${r.no || r.description}" tidak ada di PO` : 'kolom No/Uraian kosong — gunakan baris dari template';
            if (Number(r.quantity) > toNum(it.quantity) - toNum(it.receivedQty) + 1e-9) return `${it.description}: melebihi sisa PO`;
            return { ...r, itemId: it.id };
          }}
          onApply={(rows) => setQty({ ...qty, ...Object.fromEntries(rows.map((r) => [r.itemId, r.quantity])) })}
        />
      </div>
    </Modal>
  );
}

function InvoiceModal({ po, onClose, onDone }: { po: any; onClose: () => void; onDone: () => void }) {
  const expected = po.items.reduce((a: number, i: any) => a + (toNum(i.receivedQty) - toNum(i.invoicedQty)) * toNum(i.unitPrice), 0);
  const [f, setF] = useState({ supplierRef: '', invoiceDate: today(), subtotal: String(Math.round(expected)) });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const r = await api('/supplier-invoices', { body: { poId: po.id, ...f } });
      r.status === 'MATCHED' ? toast.success(`${r.number}: lolos 3-way match, siap diposting`) : toast.warning(`${r.number}: ${r.matchNotes}`);
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Catat invoice supplier" footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!f.supplierRef}>Simpan & cocokkan</Button></>}>
      <div className="space-y-4">
        <p className="rounded-lg bg-canvas px-3 py-2.5 text-sm text-ink-2">
          Nilai barang diterima yang belum ditagih (PO × GRN): <span className="num font-semibold text-ink">{rupiah(expected)}</span>. Toleransi selisih 0,5%.
        </p>
        <Field label="Nomor invoice dari supplier"><Input value={f.supplierRef} onChange={(e) => setF({ ...f, supplierRef: e.target.value })} autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal invoice"><Input type="date" value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} /></Field>
          <Field label="Subtotal ditagih (sebelum PPN)"><Input type="number" value={f.subtotal} onChange={(e) => setF({ ...f, subtotal: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

