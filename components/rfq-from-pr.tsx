'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Field, Input, Modal } from './ui';
import { api, useApi } from '@/lib/api';

/** Buat RFQ dari PR yang sudah disetujui: pilih supplier yang diundang */
export function RfqFromPrModal({ pr, onClose }: { pr: any; onClose: () => void }) {
  const router = useRouter();
  const { data: suppliers } = useApi<any[]>('/suppliers');
  const [ids, setIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const r = await api('/rfqs', { body: { requestId: pr.id, supplierIds: ids, dueDate } });
      toast.success(`${r.number} dibuat — masukkan penawaran yang diterima dari tiap supplier`);
      router.push(`/procurement/rfq/${r.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Minta penawaran untuk ${pr.number}`}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={ids.length < 1}>Buat RFQ ({ids.length} supplier)</Button></>}>
      <p className="mb-4 text-sm text-muted">Pilih minimal satu supplier; idealnya tiga untuk perbandingan yang sehat.</p>
      <Field label="Batas penawaran" className="mb-4"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {suppliers?.map((s) => (
          <label key={s.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 has-[:checked]:border-ink">
            <input type="checkbox" className="accent-[#0A4152]" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} />
            <span className="flex-1 text-sm font-medium">{s.name}</span>
            <span className="text-xs text-muted">{s.category}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
