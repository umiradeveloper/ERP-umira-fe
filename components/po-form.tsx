'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { emptyLine, LineItemsEditor, type LineItem } from './line-items';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';
import { api, useApi } from '@/lib/api';

/** Form PO — bisa dari PR yang disetujui atau manual */
export function PoForm({ open, onClose, pr }: { open: boolean; onClose: () => void; pr?: any }) {
  const router = useRouter();
  const { data: suppliers } = useApi<any[]>(open ? '/suppliers' : null);
  const { data: projects } = useApi<any[]>(open && !pr ? '/projects' : null);
  const [projectId, setProjectId] = useState(pr?.projectId ?? '');
  const [supplierId, setSupplierId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(pr?.neededAt?.slice(0, 10) ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState(pr?.project?.location ?? '');
  const [taxPct, setTaxPct] = useState('11');
  const [terms, setTerms] = useState('Pembayaran sesuai termin supplier setelah barang diterima lengkap.');
  const [items, setItems] = useState<LineItem[]>(
    pr?.items?.map((i: any) => ({ description: i.description, quantity: String(Number(i.quantity)), unit: i.unit ?? '', price: String(Number(i.estimatedPrice)), category: i.category })) ?? [emptyLine()],
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const po = await api('/purchase-orders', {
        body: {
          projectId, supplierId, requestId: pr?.id, taxPct, terms, deliveryAddress: deliveryAddress || undefined, deliveryDate: deliveryDate || undefined,
          items: items.filter((i) => i.description).map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit || undefined, unitPrice: i.price, category: i.category })),
        },
      });
      toast.success(`${po.number} dibuat sebagai draft`);
      router.push(`/procurement/po/${po.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={pr ? `Purchase order dari ${pr.number}` : 'Purchase order baru'} wide
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!projectId || !supplierId}>Simpan draft PO</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        {!pr && (
          <Field label="Proyek">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Pilih proyek</option>
              {projects?.filter((p) => !['CLOSED', 'CANCELLED'].includes(p.status)).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Supplier" className={pr ? 'sm:col-span-2' : ''}>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Pilih supplier</option>
            {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
          </Select>
        </Field>
        <Field label="PPN (%)"><Input type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} /></Field>
        <Field label="Tanggal kirim"><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
        <Field label="Alamat kirim" className="sm:col-span-2"><Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></Field>
        <Field label="Syarat & ketentuan" className="sm:col-span-3"><Textarea className="min-h-14" value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
      </div>
      <div className="mt-5">
        <LineItemsEditor items={items} onChange={setItems} priceLabel="Harga satuan" />
        {pr && <p className="mt-2 text-xs text-muted">Harga dari PR adalah estimasi — sesuaikan dengan quotation supplier terpilih.</p>}
      </div>
    </Modal>
  );
}
