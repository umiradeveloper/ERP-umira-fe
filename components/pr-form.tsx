'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { emptyLine, LineItemsEditor, type LineItem } from '@/components/line-items';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, useApi } from '@/lib/api';

export function PrForm({ open, onClose, initial, prId, onSaved }: { open: boolean; onClose: () => void; initial?: any; prId?: string; onSaved?: () => void }) {
  const router = useRouter();
  const { data: projects } = useApi<any[]>(open ? '/projects' : null);
  const [projectId, setProjectId] = useState(initial?.projectId ?? '');
  const [neededAt, setNeededAt] = useState(initial?.neededAt?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [items, setItems] = useState<LineItem[]>(
    initial?.items?.map((i: any) => ({ description: i.description, quantity: String(Number(i.quantity)), unit: i.unit ?? '', price: String(Number(i.estimatedPrice)), category: i.category })) ?? [emptyLine()],
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body = {
        projectId, notes: notes || undefined, neededAt: neededAt || undefined,
        items: items.filter((i) => i.description).map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit || undefined, estimatedPrice: i.price, category: i.category })),
      };
      if (prId) {
        await api(`/purchase-requests/${prId}`, { method: 'PUT', body });
        toast.success('PR diperbarui');
        onSaved?.();
        onClose();
      } else {
        const pr = await api('/purchase-requests', { body });
        toast.success(`${pr.number} tersimpan sebagai draft`);
        router.push(`/procurement/pr/${pr.id}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={prId ? 'Ubah purchase request' : 'Purchase request baru'} wide
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!projectId || !items.some((i) => i.description)}>Simpan draft</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Proyek" className="sm:col-span-2">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Pilih proyek</option>
            {projects?.filter((p) => !['CLOSED', 'CANCELLED'].includes(p.status)).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </Select>
        </Field>
        <Field label="Dibutuhkan tanggal"><Input type="date" value={neededAt} onChange={(e) => setNeededAt(e.target.value)} /></Field>
        <Field label="Catatan" className="sm:col-span-3"><Textarea className="min-h-14" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      <div className="mt-5"><LineItemsEditor items={items} onChange={setItems} priceLabel="Estimasi harga" /></div>
    </Modal>
  );
}
