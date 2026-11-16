'use client';

import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AgingStrip } from '@/components/aging';
import { Attachments } from '@/components/attachments';
import { ExportButton } from '@/components/export-button';
import { Badge, Button, Empty, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, Panel, Select, Table, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, pct, rupiah, today, toNum } from '@/lib/format';

export default function InvoicesPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>('/customer-invoices');
  const { data: aging, reload: reloadAging } = useApi<any>('/ar/aging');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const w = can(user, 'finance:write');
  const refresh = () => { reload(); reloadAging(); };

  return (
    <div className="animate-rise">
      <PageHeader
        title="Penagihan & piutang"
        description="Progress claim ke owner, retensi, dan penerimaan pembayaran. Setiap invoice terbit otomatis membuat jurnal."
        actions={<><ExportButton path="/exports/ar-aging.xlsx" label="Umur piutang" />{w && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Buat tagihan termin</Button>}</>}
      />
      <ErrorBox error={error} onRetry={reload} />
      <AgingStrip data={aging} title="Umur piutang owner" />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : !data?.length ? <Empty title="Belum ada tagihan" /> : (
          <Table>
            <thead><tr><Th>Nomor</Th><Th>Proyek / owner</Th><Th>Tanggal</Th><Th>Jatuh tempo</Th><Th right>Progres</Th><Th right>Total</Th><Th right>Sisa</Th><Th>Status</Th></tr></thead>
            <tbody>
              {data.map((i) => (
                <Tr key={i.id} onClick={() => setSel(i)}>
                  <Td><div className="font-medium">{i.number}</div><div className="text-xs text-muted">{i.description}</div></Td>
                  <Td><div>{i.project.ownerName ?? i.project.name}</div><div className="text-xs text-muted">{i.project.code}</div></Td>
                  <Td className="text-muted">{date(i.invoiceDate)}</Td>
                  <Td className={i.displayStatus === 'OVERDUE' ? 'font-medium text-bad' : 'text-muted'}>{date(i.dueDate)}</Td>
                  <Td right>{pct(i.progressPct, 0)}</Td>
                  <Td right className="font-medium">{rupiah(i.total)}</Td>
                  <Td right>{rupiah(toNum(i.total) - toNum(i.paidAmount))}</Td>
                  <Td><Badge status={i.displayStatus} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {open && <NewInvoice onClose={() => setOpen(false)} onDone={refresh} />}
      {sel && <InvoiceDrawer id={sel.id} canWrite={w} onClose={() => setSel(null)} onDone={refresh} />}
    </div>
  );
}

function NewInvoice({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: projects } = useApi<any[]>('/projects');
  const { data: invoices } = useApi<any[]>('/customer-invoices');
  const [f, setF] = useState({ projectId: '', invoiceDate: today(), progressPct: '', description: '' });
  const [saving, setSaving] = useState(false);
  const p = projects?.find((x) => x.id === f.projectId);
  const prev = useMemo(() => Math.max(0, ...(invoices ?? []).filter((i) => i.projectId === f.projectId && i.status !== 'CANCELLED').map((i) => toNum(i.progressPct))), [invoices, f.projectId]);
  const gross = p ? (toNum(p.contractValue) * (toNum(f.progressPct) - prev)) / 100 : 0;
  const ret = p ? (gross * toNum(p.retentionPct)) / 100 : 0;
  const tax = gross * 0.11;

  async function save() {
    setSaving(true);
    try {
      const r = await api('/customer-invoices', { body: { ...f, description: f.description || undefined } });
      toast.success(`${r.number} dibuat sebagai draft`);
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Tagihan termin (progress claim)"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!f.projectId || !f.progressPct}>Simpan draft</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Proyek" className="sm:col-span-2">
          <Select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
            <option value="">Pilih proyek</option>
            {projects?.filter((x) => ['ACTIVE', 'COMPLETION'].includes(x.status)).map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
          </Select>
        </Field>
        <Field label="Tanggal invoice"><Input type="date" value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} /></Field>
        <Field label="Progres kumulatif ditagih (%)" hint={p ? `Sudah ditagih ${prev}%. Progres fisik ${pct(p.progressPct, 0)}.` : undefined}>
          <Input type="number" value={f.progressPct} onChange={(e) => setF({ ...f, progressPct: e.target.value })} />
        </Field>
        <Field label="Keterangan" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="mis. Termin 4 — progres 65%" /></Field>
      </div>
      {p && gross > 0 && (
        <dl className="mt-5 space-y-1.5 rounded-lg bg-canvas p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Nilai progres ({toNum(f.progressPct) - prev}% × kontrak)</dt><dd className="num">{rupiah(gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Retensi {pct(p.retentionPct, 0)}</dt><dd className="num">− {rupiah(ret)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">PPN 11%</dt><dd className="num">{rupiah(tax)}</dd></div>
          <div className="flex justify-between border-t border-line-strong pt-1.5 font-semibold"><dt>Total ditagih</dt><dd className="num">{rupiah(gross - ret + tax)}</dd></div>
        </dl>
      )}
    </Modal>
  );
}

function InvoiceDrawer({ id, canWrite, onClose, onDone }: { id: string; canWrite: boolean; onClose: () => void; onDone: () => void }) {
  const { data: i, reload } = useApi<any>(`/customer-invoices/${id}`);
  const [busy, setBusy] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(today());
  if (!i) return <Modal open onClose={onClose} title="Invoice"><Loading /></Modal>;
  const outstanding = toNum(i.total) - toNum(i.paidAmount);

  async function act(key: string, path: string, body: any, msg: string) {
    setBusy(key);
    try {
      await api(path, { body });
      toast.success(msg);
      reload();
      onDone();
      setAmount('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <Modal open onClose={onClose} title={`${i.number} — ${i.project.name}`} wide
      footer={
        canWrite && i.status === 'DRAFT' ? (
          <>
            <Button variant="danger" loading={busy === 'c'} onClick={() => act('c', `/customer-invoices/${id}/cancel`, {}, 'Invoice dibatalkan')}>Batalkan</Button>
            <Button loading={busy === 'i'} onClick={() => act('i', `/customer-invoices/${id}/issue`, {}, 'Invoice diterbitkan dan dijurnal')}>Terbitkan invoice</Button>
          </>
        ) : undefined
      }>
      <div className="mb-5 flex items-center gap-2"><Badge status={i.displayStatus} /><span className="flex-1 text-sm text-muted">{i.description}</span>{i.status !== 'DRAFT' && <ExportButton size="sm" path={`/documents/customer-invoices/${id}.pdf`} label="PDF invoice" kind="pdf" />}</div>
      <KV cols={4} items={[
        ['Nilai progres', rupiah(i.grossAmount)], ['Retensi', rupiah(i.retentionAmount)], ['PPN', rupiah(i.taxAmount)], ['Total', rupiah(i.total)],
        ['Tanggal', date(i.invoiceDate)], ['Jatuh tempo', date(i.dueDate)], ['Diterima', rupiah(i.paidAmount)], ['Sisa', rupiah(outstanding)],
      ]} />

      {i.receipts.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold">Penerimaan</h4>
          <Table>
            <tbody>{i.receipts.map((r: any) => <Tr key={r.id}><Td className="font-medium">{r.number}</Td><Td>{date(r.receiptDate)}</Td><Td>{r.method}</Td><Td right>{rupiah(r.amount)}</Td></Tr>)}</tbody>
          </Table>
        </div>
      )}

      <div className="mt-6"><Attachments compact entityType="CustomerInvoice" entityId={id} canUpload={canWrite} title="Lampiran (berita acara, faktur pajak, bukti transfer)" /></div>

      {canWrite && ['ISSUED', 'PARTIAL_PAID'].includes(i.status) && (
        <div className="mt-6 rounded-lg border border-line p-4">
          <h4 className="mb-3 text-sm font-semibold">Catat penerimaan pembayaran</h4>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Tanggal"><Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /></Field>
            <Field label="Nominal" className="flex-1"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(Math.round(outstanding))} /></Field>
            <Button variant="secondary" onClick={() => setAmount(String(outstanding))}>Lunasi</Button>
            <Button loading={busy === 'r'} disabled={!amount} onClick={() => act('r', `/customer-invoices/${id}/receipts`, { receiptDate, amount }, 'Penerimaan dicatat')}>Simpan</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
