'use client';

import { Plus, RefreshCw } from 'lucide-react';
import { bulkCreate, clean, ExcelImport } from '@/components/excel-import';
import type { ExcelCol } from '@/lib/excel';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Empty, Field, Input, Loading, Modal, PageHeader, Panel, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const CUSTOMER_COLS: ExcelCol[] = [
  { key: 'code', header: 'Kode', required: true, note: 'Huruf besar, angka, tanda minus (2-20)' },
  { key: 'name', header: 'Nama', required: true, width: 34 },
  { key: 'npwp', header: 'NPWP', width: 22 },
  { key: 'email', header: 'Email', width: 26 },
  { key: 'phone', header: 'Telepon', width: 16 },
  { key: 'address', header: 'Alamat', width: 40 },
];
const SUPPLIER_COLS: ExcelCol[] = [
  { key: 'code', header: 'Kode', required: true, note: 'Huruf besar, angka, tanda minus (2-20)' },
  { key: 'name', header: 'Nama', required: true, width: 34 },
  { key: 'category', header: 'Kategori', width: 18, note: 'mis. Material / Subkon / Alat' },
  { key: 'taxNumber', header: 'NPWP', width: 22 },
  { key: 'email', header: 'Email', width: 26 },
  { key: 'phone', header: 'Telepon', width: 16 },
  { key: 'paymentTerm', header: 'Termin (hari)', type: 'integer' },
];

export default function MasterPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers');
  const { data, loading, reload } = useApi<any[]>(`/${tab}`);
  const [edit, setEdit] = useState<any>(null);
  const w = can(user, 'master:write') || (tab === 'suppliers' && can(user, 'procurement:write'));
  const { data: sync, reload: reloadSync } = useApi<any>(tab === 'suppliers' ? '/suppliers/sync' : null);
  const [syncing, setSyncing] = useState(false);
  const locked = tab === 'suppliers' && sync?.manualInput === false;
  const canAdd = w && !locked;
  async function runSync() {
    setSyncing(true);
    try {
      const r = await api('/suppliers/sync', { body: {} });
      toast.success(`Sinkron selesai: ${r.created} baru, ${r.updated} diperbarui${r.skipped.length ? `, ${r.skipped.length} dilewati` : ''}`);
      reload();
      reloadSync();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader title="Customer & supplier" description="Data owner proyek dan vendor. Kode unik per perusahaan; data yang sudah dipakai transaksi diarsipkan, bukan dihapus."
        actions={w && (
          <>
            {tab === 'suppliers' && sync?.configured && (
              <Button variant="secondary" icon={<RefreshCw className="size-4" />} loading={syncing} onClick={runSync}>Sinkron vendor</Button>
            )}
            {canAdd && <ExcelImport
              key={tab}
              size="md"
              title={tab === 'customers' ? 'Impor customer dari Excel' : 'Impor supplier dari Excel'}
              templateName={tab === 'customers' ? 'template-customer' : 'template-supplier'}
              hint="Kode yang sudah ada akan diperbarui, kode baru akan ditambahkan."
              columns={tab === 'customers' ? CUSTOMER_COLS : SUPPLIER_COLS}
              onApply={async (rows, _m, lines) => {
                const byCode = new Map((data ?? []).map((r) => [String(r.code).toUpperCase(), r]));
                const res = await bulkCreate(rows, lines, (r) => {
                  const body: any = clean({ ...r, code: r.code.trim().toUpperCase() });
                  if (body.paymentTerm) body.paymentTerm = Number(body.paymentTerm);
                  const ex = byCode.get(body.code);
                  return ex ? api(`/${tab}/${ex.id}`, { method: 'PATCH', body }) : api(`/${tab}`, { body });
                });
                reload();
                return res;
              }}
            />}
            {canAdd && <Button icon={<Plus className="size-4" />} onClick={() => setEdit({})}>{tab === 'customers' ? 'Customer baru' : 'Supplier baru'}</Button>}
          </>
        )} />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'customers', label: 'Customer / owner' }, { value: 'suppliers', label: 'Supplier & subkon' }]} />
      {tab === 'suppliers' && sync?.configured && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          <span className="font-medium">Sumber vendor: <span className="num text-ink-2">{sync.source}</span></span>
          <span className="text-muted">{sync.lastSync ? `Sinkron terakhir ${new Date(sync.lastSync.at).toLocaleString('id-ID')} — ${sync.lastSync.fetched} vendor, ${sync.lastSync.created} baru, ${sync.lastSync.updated} diperbarui` : 'Belum pernah disinkron sejak server berjalan'}</span>
          {sync.intervalMin && <span className="text-muted">Otomatis tiap {sync.intervalMin} menit</span>}
          {locked && <span className="text-signal-ink">Input manual dimatikan — data vendor hanya dari sumber</span>}
          {sync.lastSync?.skipped?.length > 0 && (
            <details className="w-full text-xs text-warn">
              <summary className="cursor-pointer">{sync.lastSync.skipped.length} vendor dilewati</summary>
              <ul className="mt-1 space-y-0.5">{sync.lastSync.skipped.slice(0, 50).map((x: any) => <li key={x.index}>Data ke-{x.index}: {x.reason}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : !data?.length ? <Empty title="Belum ada data" /> : (
          <Table>
            <thead><tr><Th>Kode</Th><Th>Nama</Th>{tab === 'suppliers' && <Th>Kategori</Th>}<Th>Email</Th><Th>Telepon</Th>{tab === 'suppliers' && <Th right>Termin</Th>}</tr></thead>
            <tbody>
              {data.map((r) => (
                <Tr key={r.id} onClick={w && !locked ? () => setEdit(r) : undefined}>
                  <Td className="num font-medium">{r.code}</Td>
                  <Td className="font-medium">{r.name}</Td>
                  {tab === 'suppliers' && <Td className="text-muted">{r.category}</Td>}
                  <Td className="text-muted">{r.email ?? '—'}</Td>
                  <Td className="text-muted">{r.phone ?? '—'}</Td>
                  {tab === 'suppliers' && <Td right>{r.paymentTerm} hari</Td>}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {edit && <EditModal kind={tab} row={edit} onClose={() => setEdit(null)} onDone={reload} />}
    </div>
  );
}

function EditModal({ kind, row, onClose, onDone }: { kind: 'customers' | 'suppliers'; row: any; onClose: () => void; onDone: () => void }) {
  const isNew = !row.id;
  const [f, setF] = useState<any>({ code: row.code ?? '', name: row.name ?? '', email: row.email ?? '', phone: row.phone ?? '', ...(kind === 'suppliers' ? { category: row.category ?? '', paymentTerm: row.paymentTerm ?? 30 } : { npwp: row.npwp ?? '', address: row.address ?? '' }) });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setSaving(true);
    try {
      const body: any = { ...f, code: f.code.toUpperCase() };
      if (kind === 'suppliers') body.paymentTerm = Number(f.paymentTerm);
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      await api(isNew ? `/${kind}` : `/${kind}/${row.id}`, { method: isNew ? 'POST' : 'PATCH', body });
      toast.success('Tersimpan');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function archive() {
    try {
      await api(`/${kind}/${row.id}`, { method: 'DELETE' });
      toast.success('Diarsipkan');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  return (
    <Modal open onClose={onClose} title={isNew ? (kind === 'customers' ? 'Customer baru' : 'Supplier baru') : f.name}
      footer={<>{!isNew && <Button variant="danger" onClick={archive} className="mr-auto">Arsipkan</Button>}<Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!f.code || !f.name}>Simpan</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kode"><Input value={f.code} onChange={set('code')} /></Field>
        {kind === 'suppliers' ? <Field label="Kategori"><Input value={f.category} onChange={set('category')} placeholder="Material / Subkon / Alat" /></Field> : <Field label="NPWP"><Input value={f.npwp} onChange={set('npwp')} /></Field>}
        <Field label="Nama" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Telepon"><Input value={f.phone} onChange={set('phone')} /></Field>
        {kind === 'suppliers' && <Field label="Termin pembayaran (hari)"><Input type="number" value={f.paymentTerm} onChange={set('paymentTerm')} /></Field>}
      </div>
    </Modal>
  );
}
