'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { AgingStrip } from '@/components/aging';
import { ExportButton } from '@/components/export-button';
import { Badge, Button, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Panel, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, rupiah, today, toNum } from '@/lib/format';

const GROUPS: Record<string, string[]> = {
  review: ['DRAFT', 'MATCHED', 'MISMATCH'],
  payable: ['POSTED', 'PARTIAL_PAID'],
  paid: ['PAID', 'CANCELLED'],
};

export default function ApPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>('/supplier-invoices');
  const { data: aging, reload: reloadAging } = useApi<any>('/ap/aging');
  const [tab, setTab] = useState('review');
  const [pay, setPay] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const w = can(user, 'finance:write');
  const rows = (data ?? []).filter((r) => GROUPS[tab].includes(r.status));
  const count = (g: string) => (data ?? []).filter((r) => GROUPS[g].includes(r.status)).length;
  const refresh = () => { reload(); reloadAging(); };

  async function post(id: string) {
    setBusy(id);
    try {
      await api(`/supplier-invoices/${id}/post`, { body: {} });
      toast.success('Invoice diposting — biaya proyek & jurnal hutang tercatat');
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader title="Hutang supplier" description="Invoice supplier dicocokkan dengan PO dan penerimaan barang (3-way match) sebelum diposting dan dibayar." actions={<ExportButton path="/exports/ap-aging.xlsx" label="Umur hutang" />} />
      <AgingStrip data={aging} title="Umur hutang supplier" />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'review', label: 'Perlu diproses', count: count('review') },
        { value: 'payable', label: 'Siap dibayar', count: count('payable') },
        { value: 'paid', label: 'Lunas', count: count('paid') },
      ]} />
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty title="Tidak ada invoice di sini">Invoice supplier dicatat dari halaman PO.</Empty> : (
          <Table>
            <thead><tr><Th>Nomor</Th><Th>Supplier</Th><Th>PO / proyek</Th><Th>Jatuh tempo</Th><Th right>Total</Th><Th right>Sisa</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const overdue = ['POSTED', 'PARTIAL_PAID'].includes(r.status) && new Date(r.dueDate) < new Date();
                return (
                  <Tr key={r.id}>
                    <Td><div className="font-medium">{r.number}</div><div className="text-xs text-muted">{r.supplierRef}</div></Td>
                    <Td>{r.supplier.name}</Td>
                    <Td>{r.po ? <Link href={`/procurement/po/${r.poId}`} className="hover:underline underline-offset-2">{r.po.number}</Link> : '—'}<div className="text-xs text-muted">{r.project.code}</div></Td>
                    <Td className={overdue ? 'font-medium text-bad' : 'text-muted'}>{date(r.dueDate)}</Td>
                    <Td right className="font-medium">{rupiah(r.total)}</Td>
                    <Td right>{rupiah(toNum(r.total) - toNum(r.paidAmount))}</Td>
                    <Td>
                      <Badge status={r.status} />
                      {r.status === 'MISMATCH' && <div className="mt-1 max-w-[220px] text-xs text-bad">{r.matchNotes}</div>}
                    </Td>
                    <Td right>
                      {w && r.status === 'MATCHED' && <Button size="sm" loading={busy === r.id} onClick={() => post(r.id)}>Posting</Button>}
                      {w && ['POSTED', 'PARTIAL_PAID'].includes(r.status) && <Button size="sm" variant="secondary" onClick={() => setPay(r)}>Bayar</Button>}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
      {pay && <PayModal inv={pay} onClose={() => setPay(null)} onDone={refresh} />}
    </div>
  );
}

function PayModal({ inv, onClose, onDone }: { inv: any; onClose: () => void; onDone: () => void }) {
  const outstanding = toNum(inv.total) - toNum(inv.paidAmount);
  const [f, setF] = useState({ paymentDate: today(), amount: String(outstanding), method: 'TRANSFER' });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api(`/supplier-invoices/${inv.id}/pay`, { body: f });
      toast.success('Pembayaran dicatat dan dijurnal');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Bayar ${inv.number}`} footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving}>Catat pembayaran</Button></>}>
      <p className="mb-4 text-sm text-ink-2">{inv.supplier.name} — sisa tagihan <span className="num font-semibold">{rupiah(outstanding)}</span></p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal bayar"><Input type="date" value={f.paymentDate} onChange={(e) => setF({ ...f, paymentDate: e.target.value })} /></Field>
        <Field label="Nominal"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
