'use client';

import { ExcelImport } from '@/components/excel-import';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/export-button';
import { Badge, Button, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, rupiah, today, toNum } from '@/lib/format';

const SOURCE: Record<string, string> = {
  MANUAL: 'Manual', SupplierInvoice: 'Invoice supplier', SupplierPayment: 'Pembayaran supplier', CustomerInvoice: 'Invoice owner',
  CustomerReceipt: 'Penerimaan owner', REVERSAL: 'Reversal', OPENING: 'Saldo awal',
};

export default function JournalsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi<any[]>(`/journals${status ? `?status=${status}` : ''}`);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const w = can(user, 'accounting:write');

  return (
    <div className="animate-rise">
      <PageHeader
        title="Jurnal umum"
        description="Jurnal otomatis dari transaksi dan jurnal manual. Jurnal yang sudah diposting tidak dapat diubah — koreksi melalui reversal."
        actions={
          <>
            <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
              <option value="">Semua status</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Diposting</option>
              <option value="REVERSED">Dibalik</option>
            </Select>
            <ExportButton path="/exports/journals.xlsx" />
            {w && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Jurnal manual</Button>}
          </>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : !data?.length ? <Empty title="Belum ada jurnal" /> : (
          <Table>
            <thead><tr><Th>Nomor</Th><Th>Tanggal</Th><Th>Keterangan</Th><Th>Sumber</Th><Th>Periode</Th><Th right>Nilai</Th><Th>Status</Th></tr></thead>
            <tbody>
              {data.map((j) => (
                <Tr key={j.id} onClick={() => setSel(j.id)}>
                  <Td className="font-medium">{j.number}</Td>
                  <Td className="text-muted">{date(j.entryDate)}</Td>
                  <Td className="max-w-md truncate">{j.description}</Td>
                  <Td className="text-muted">{SOURCE[j.sourceType] ?? j.sourceType}</Td>
                  <Td className="num text-muted">{j.period}</Td>
                  <Td right>{rupiah(j.totalDebit)}</Td>
                  <Td><Badge status={j.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {open && <NewJournal onClose={() => setOpen(false)} onDone={reload} />}
      {sel && <JournalModal id={sel} canWrite={w} onClose={() => setSel(null)} onDone={reload} />}
    </div>
  );
}

function JournalModal({ id, canWrite, onClose, onDone }: { id: string; canWrite: boolean; onClose: () => void; onDone: () => void }) {
  const { data: j, reload } = useApi<any>(`/journals/${id}`);
  const [busy, setBusy] = useState('');
  async function act(key: string, fn: () => Promise<any>, msg: string, close = false) {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      onDone();
      close ? onClose() : reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }
  if (!j) return <Modal open onClose={onClose} title="Jurnal"><Loading /></Modal>;
  const dr = j.lines.reduce((a: number, l: any) => a + toNum(l.debit), 0);
  const cr = j.lines.reduce((a: number, l: any) => a + toNum(l.credit), 0);
  return (
    <Modal open onClose={onClose} title={`${j.number} — ${date(j.entryDate)}`} wide
      footer={canWrite && (
        <>
          {j.status === 'DRAFT' && <Button variant="danger" loading={busy === 'd'} onClick={() => act('d', () => api(`/journals/${id}`, { method: 'DELETE' }), 'Draft dihapus', true)}>Hapus draft</Button>}
          {j.status === 'DRAFT' && <Button loading={busy === 'p'} onClick={() => act('p', () => api(`/journals/${id}/post`, { body: {} }), 'Jurnal diposting')}>Posting</Button>}
          {j.status === 'POSTED' && <Button variant="secondary" loading={busy === 'r'} onClick={() => act('r', () => api(`/journals/${id}/reverse`, { body: {} }), 'Jurnal reversal dibuat')}>Buat reversal</Button>}
        </>
      )}>
      <div className="mb-4 flex items-center gap-2 text-sm"><Badge status={j.status} /><span className="text-muted">{j.description}</span></div>
      <Table>
        <thead><tr><Th>Akun</Th><Th>Keterangan</Th><Th right>Debit</Th><Th right>Kredit</Th></tr></thead>
        <tbody>
          {j.lines.map((l: any) => (
            <Tr key={l.id}>
              <Td><span className="num text-muted">{l.account.code}</span> <span className={toNum(l.credit) > 0 ? 'pl-4' : ''}>{l.account.name}</span></Td>
              <Td className="text-muted">{l.description}</Td>
              <Td right>{toNum(l.debit) ? rupiah(l.debit) : ''}</Td>
              <Td right>{toNum(l.credit) ? rupiah(l.credit) : ''}</Td>
            </Tr>
          ))}
          <tr className="font-semibold"><Td colSpan={2}>Total</Td><Td right>{rupiah(dr)}</Td><Td right>{rupiah(cr)}</Td></tr>
        </tbody>
      </Table>
    </Modal>
  );
}

type Line = { accountId: string; debit: string; credit: string; description: string };
function NewJournal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: accounts } = useApi<any[]>('/accounts');
  const [entryDate, setDate] = useState(today());
  const [description, setDesc] = useState('');
  const [lines, setLines] = useState<Line[]>([{ accountId: '', debit: '0', credit: '0', description: '' }, { accountId: '', debit: '0', credit: '0', description: '' }]);
  const [saving, setSaving] = useState(false);
  const dr = lines.reduce((a, l) => a + toNum(l.debit), 0);
  const cr = lines.reduce((a, l) => a + toNum(l.credit), 0);
  const balanced = dr > 0 && Math.abs(dr - cr) < 0.005;
  const upd = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, x) => (x === i ? { ...l, [k]: v } : l)));

  async function save() {
    setSaving(true);
    try {
      const j = await api('/journals', { body: { entryDate, description, lines: lines.map((l) => ({ ...l, debit: l.debit || '0', credit: l.credit || '0', description: l.description || undefined })) } });
      toast.success(`${j.number} tersimpan sebagai draft. Posting dilakukan oleh user lain.`);
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Jurnal manual" wide
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!balanced || lines.some((l) => !l.accountId)}>Simpan draft</Button></>}>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Field label="Tanggal"><Input type="date" value={entryDate} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Keterangan" className="sm:col-span-2"><Input value={description} onChange={(e) => setDesc(e.target.value)} /></Field>
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_120px_120px_32px] gap-2">
            <Select className="h-9 text-[13px]" value={l.accountId} onChange={(e) => upd(i, 'accountId', e.target.value)} aria-label="Akun">
              <option value="">Pilih akun</option>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </Select>
            <Input className="h-9 text-[13px]" placeholder="Keterangan baris" value={l.description} onChange={(e) => upd(i, 'description', e.target.value)} />
            <Input type="number" className="h-9 text-[13px]" aria-label="Debit" value={l.debit} onChange={(e) => upd(i, 'debit', e.target.value)} />
            <Input type="number" className="h-9 text-[13px]" aria-label="Kredit" value={l.credit} onChange={(e) => upd(i, 'credit', e.target.value)} />
            <button disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, x) => x !== i))} className="rounded p-1 text-faint hover:text-bad disabled:opacity-30" aria-label="Hapus baris"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setLines([...lines, { accountId: '', debit: '0', credit: '0', description: '' }])}>Tambah baris</Button>
          <ExcelImport
            title="Impor baris jurnal dari Excel"
            templateName="template-jurnal"
            modes
            hint='Isi kode akun sesuai sheet "Akun". Satu baris hanya debit atau kredit.'
            columns={[
              { key: 'accountCode', header: 'Kode akun', required: true },
              { key: 'description', header: 'Keterangan', width: 36 },
              { key: 'debit', header: 'Debit', type: 'number', width: 18 },
              { key: 'credit', header: 'Kredit', type: 'number', width: 18 },
            ]}
            refSheets={[{ name: 'Akun', headers: ['Kode', 'Nama akun', 'Tipe'], rows: (accounts ?? []).map((a) => [a.code, a.name, a.accountType]) }]}
            resolve={(r) => {
              const a = accounts?.find((x) => String(x.code) === r.accountCode.trim());
              if (!a) return `kode akun "${r.accountCode}" tidak ditemukan`;
              if (!(Number(r.debit) > 0) && !(Number(r.credit) > 0)) return 'isi debit atau kredit';
              return { ...r, accountId: a.id };
            }}
            onApply={(rows, mode) => {
              const add = rows.map((r) => ({ accountId: r.accountId, description: r.description, debit: r.debit || '0', credit: r.credit || '0' }));
              setLines(mode === 'replace' ? add : [...lines.filter((l) => l.accountId), ...add]);
            }}
          />
        </div>
        <div className="num flex gap-5 text-sm">
          <span>Debit <b>{rupiah(dr)}</b></span>
          <span>Kredit <b>{rupiah(cr)}</b></span>
          <Badge label={balanced ? 'Balance' : `Selisih ${rupiah(Math.abs(dr - cr))}`} tone={balanced ? 'ok' : 'bad'} />
        </div>
      </div>
    </Modal>
  );
}
