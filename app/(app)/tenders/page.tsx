'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, rupiahShort } from '@/lib/format';

const FILTERS = [
  { value: 'open', label: 'Dalam proses', match: ['DRAFT', 'REVIEW', 'SUBMITTED'] },
  { value: 'WON', label: 'Menang', match: ['WON'] },
  { value: 'closed', label: 'Kalah / batal', match: ['LOST', 'CANCELLED'] },
  { value: 'all', label: 'Semua', match: [] as string[] },
] as const;

export default function TendersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<any[]>('/tenders');
  const [filter, setFilter] = useState<string>('open');
  const [open, setOpen] = useState(false);

  const rows = (data ?? []).filter((t) => {
    const f = FILTERS.find((x) => x.value === filter)!;
    return f.match.length === 0 || (f.match as readonly string[]).includes(t.status);
  });

  return (
    <div className="animate-rise">
      <PageHeader
        title="Tender & BQ"
        description="Susun BQ dan estimasi biaya, ajukan penawaran, lalu konversi tender yang menang menjadi proyek."
        actions={can(user, 'tender:write') && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Tender baru</Button>}
      />
      <Tabs
        value={filter}
        onChange={setFilter}
        items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: (data ?? []).filter((t) => f.match.length === 0 || (f.match as readonly string[]).includes(t.status)).length }))}
      />
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty title="Tidak ada tender di sini" /> : (
          <Table>
            <thead>
              <tr><Th>Tender</Th><Th>Owner</Th><Th>Batas penawaran</Th><Th right>Biaya langsung</Th><Th right>Nilai penawaran</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const overdue = t.deadline && new Date(t.deadline) < new Date() && ['DRAFT', 'REVIEW'].includes(t.status);
                return (
                  <Tr key={t.id} href={`/tenders/${t.id}`}>
                    <Td>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted">{t.number} — {t.itemCount} item BQ</div>
                    </Td>
                    <Td className="text-ink-2">{t.customer?.name ?? '—'}</Td>
                    <Td className={overdue ? 'text-bad' : 'text-muted'}>{date(t.deadline)}</Td>
                    <Td right>{rupiahShort(t.totals.directCost)}</Td>
                    <Td right className="font-medium">{rupiahShort(t.totals.grandTotal)}</Td>
                    <Td><Badge status={t.status} /></Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
      <NewTender open={open} onClose={() => setOpen(false)} onCreated={(id) => router.push(`/tenders/${id}`)} />
    </div>
  );
}

function NewTender({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { data: customers } = useApi<any[]>(open ? '/customers' : null);
  const [f, setF] = useState({ title: '', customerId: '', location: '', deadline: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setSaving(true);
    try {
      const body: any = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      const t = await api('/tenders', { body });
      toast.success(`Tender ${t.number} dibuat — lanjutkan isi BQ`);
      onCreated(t.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Tender baru"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!f.title}>Buat & isi BQ</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama paket pekerjaan" className="sm:col-span-2"><Input value={f.title} onChange={set('title')} autoFocus /></Field>
        <Field label="Owner">
          <Select value={f.customerId} onChange={set('customerId')}>
            <option value="">Pilih customer</option>
            {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Batas penawaran"><Input type="date" value={f.deadline} onChange={set('deadline')} /></Field>
        <Field label="Lokasi" className="sm:col-span-2"><Input value={f.location} onChange={set('location')} /></Field>
      </div>
    </Modal>
  );
}
