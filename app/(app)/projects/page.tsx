'use client';

import { bulkCreate, clean, ExcelImport } from '@/components/excel-import';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/export-button';
import { ProjectPhoto } from '@/components/project-photo';
import { Badge, Button, Empty, ErrorBox, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pct, rupiahShort, toNum } from '@/lib/format';

export default function ProjectsPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>('/projects');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const canWrite = can(user, 'project:write');
  const { data: customers } = useApi<any[]>(canWrite ? '/customers' : null);

  const rows = (data ?? []).filter((p) => !q || `${p.code} ${p.name} ${p.ownerName ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="animate-rise">
      <PageHeader
        title="Proyek"
        description="Nilai kontrak (RAB) dan status setiap proyek. BK/PU dan efisiensi ada di halaman detail proyek."
        actions={<><ExportButton path="/exports/projects.xlsx" />{canWrite && (
          <ExcelImport
            size="md"
            title="Impor proyek dari Excel"
            templateName="template-proyek"
            hint='Kode proyek dibuat otomatis. Kode customer sesuai sheet "Customer".'
            columns={[
              { key: 'name', header: 'Nama proyek', required: true, width: 36 },
              { key: 'customerCode', header: 'Kode customer', width: 16 },
              { key: 'location', header: 'Lokasi', width: 24 },
              { key: 'contractValue', header: 'Nilai kontrak', type: 'number', required: true, width: 20 },
              { key: 'retentionPct', header: 'Retensi (%)', type: 'number' },
              { key: 'startDate', header: 'Mulai', type: 'date' },
              { key: 'endDate', header: 'Selesai', type: 'date' },
              { key: 'managerName', header: 'Project manager', width: 22 },
            ]}
            refSheets={() => [{ name: 'Customer', headers: ['Kode', 'Nama'], rows: (customers ?? []).map((c) => [c.code, c.name]) }]}
            resolve={(r) => {
              if (!r.customerCode) return r;
              const c = customers?.find((x) => x.code.toUpperCase() === r.customerCode.trim().toUpperCase());
              return c ? { ...r, customerId: c.id } : `kode customer "${r.customerCode}" tidak ditemukan`;
            }}
            onApply={async (xs, _m, lines) => {
              const res = await bulkCreate(xs, lines, (r) => api('/projects', { body: clean({ name: r.name, customerId: r.customerId, location: r.location, contractValue: r.contractValue, retentionPct: r.retentionPct || '5', startDate: r.startDate, endDate: r.endDate, managerName: r.managerName}) }));
              reload();
              return res;
            }}
          />
        )}{canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Proyek baru</Button>}</>}
      />
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0" title={<Input placeholder="Cari kode, nama, atau owner…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-72" />}>
        {loading && !data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty title="Tidak ada proyek">Proyek dibuat otomatis saat tender ditandai menang, atau buat manual.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Proyek</Th>
                <Th>Owner</Th>
                <Th right>Nilai kontrak (RAB)</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Tr key={p.id} href={`/projects/${p.id}`}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <ProjectPhoto fileId={p.coverFileId} className="size-11" />
                      <div className="min-w-0">
                        <div className="font-medium">{p.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">{p.code} <Badge status={p.status} /></div>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-ink-2">{p.ownerName ?? '—'}</Td>
                  <Td right className="font-medium">{rupiahShort(p.contractValue)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <NewProject open={open} onClose={() => setOpen(false)} onDone={reload} />
    </div>
  );
}

function NewProject({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const { data: customers } = useApi<any[]>(open ? '/customers' : null);
  const [f, setF] = useState({ name: '', customerId: '', location: '', managerName: '', contractValue: '', retentionPct: '5', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setSaving(true);
    try {
      const body: any = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      const p = await api('/projects', { body });
      toast.success(`Proyek ${p.code} dibuat`);
      onDone();
      router.push(`/projects/${p.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proyek baru"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={save} loading={saving} disabled={!f.name || !f.contractValue}>Buat proyek</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama proyek" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Owner / customer">
          <Select value={f.customerId} onChange={set('customerId')}>
            <option value="">Pilih customer</option>
            {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Lokasi"><Input value={f.location} onChange={set('location')} /></Field>
        <Field label="Nilai kontrak (Rp)"><Input type="number" value={f.contractValue} onChange={set('contractValue')} /></Field>
        <Field label="Retensi (%)"><Input type="number" value={f.retentionPct} onChange={set('retentionPct')} /></Field>
        <Field label="Mulai"><Input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="Selesai"><Input type="date" value={f.endDate} onChange={set('endDate')} /></Field>
        <Field label="Project manager"><Input value={f.managerName} onChange={set('managerName')} /></Field>
      </div>
    </Modal>
  );
}
