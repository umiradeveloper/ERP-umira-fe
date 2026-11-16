'use client';

import { bulkCreate, clean, ExcelImport } from '@/components/excel-import';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/export-button';
import { Attachments } from '@/components/attachments';
import { Badge, Button, Empty, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, Panel, Select, Table, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, dateTime, rupiah, rupiahShort, today } from '@/lib/format';

const MOVE: Record<string, string> = { ASSIGN: 'Dialokasikan', TRANSFER: 'Transfer', RETURN: 'Dikembalikan' };

export default function AssetsPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>('/assets');
  const [sel, setSel] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const w = can(user, 'asset:write');
  const count = (s: string) => (data ?? []).filter((a) => a.status === s).length;

  return (
    <div className="animate-rise">
      <PageHeader title="Aset & alat" description="Register alat berat dan peralatan, alokasi ke proyek, serta jadwal maintenance."
        actions={<><ExportButton path="/exports/assets.xlsx" />{w && (
          <ExcelImport
            size="md"
            title="Impor aset dari Excel"
            templateName="template-aset"
            columns={[
              { key: 'assetTag', header: 'Tag aset', required: true, note: 'Huruf besar & angka, mis. EXC-003' },
              { key: 'name', header: 'Nama', required: true, width: 32 },
              { key: 'category', header: 'Kategori', type: 'enum', required: true, options: ['Alat Berat', 'Kendaraan', 'Peralatan', 'Survey', 'IT'].map((c) => ({ value: c, label: c })) },
              { key: 'serialNumber', header: 'Nomor seri', width: 18 },
              { key: 'ownership', header: 'Kepemilikan', type: 'enum', options: [{ value: 'OWNED', label: 'Milik sendiri' }, { value: 'RENTAL', label: 'Sewa' }] },
              { key: 'acquisitionCost', header: 'Harga perolehan', type: 'number', width: 18 },
              { key: 'acquisitionDate', header: 'Tanggal perolehan', type: 'date', width: 18 },
            ]}
            onApply={async (rows, _m, lines) => {
              const res = await bulkCreate(rows, lines, (r) => api('/assets', { body: clean({ ...r, assetTag: r.assetTag.trim().toUpperCase(), ownership: r.ownership || 'OWNED' }) }));
              reload();
              return res;
            }}
          />
        )}{w && <Button icon={<Plus className="size-4" />} onClick={() => setCreate(true)}>Daftarkan aset</Button>}</>} />
      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 [&>*]:bg-surface [&>*]:px-5 [&>*]:py-4">
        {[['ASSIGNED', 'Di proyek'], ['AVAILABLE', 'Tersedia di gudang'], ['IN_MAINTENANCE', 'Sedang maintenance'], ['', 'Total nilai buku']].map(([s, l]) => (
          <div key={l}>
            <div className="text-[13px] text-muted">{l}</div>
            <div className="num mt-1 text-[22px] font-semibold">{s ? count(s) : rupiahShort((data ?? []).reduce((a, x) => a + Number(x.bookValue), 0))}</div>
          </div>
        ))}
      </section>
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : !data?.length ? <Empty title="Belum ada aset" /> : (
          <Table>
            <thead><tr><Th>Tag</Th><Th>Nama</Th><Th>Kategori</Th><Th>Lokasi / proyek</Th><Th>Kondisi</Th><Th right>Nilai buku</Th><Th>Status</Th></tr></thead>
            <tbody>
              {data.map((a) => (
                <Tr key={a.id} onClick={() => setSel(a.id)}>
                  <Td className="num font-medium">{a.assetTag}</Td>
                  <Td><div className="font-medium">{a.name}</div>{a.serialNumber && <div className="text-xs text-muted">SN {a.serialNumber}</div>}</Td>
                  <Td className="text-muted">{a.category}</Td>
                  <Td>{a.project ? <><div>{a.project.name}</div><div className="text-xs text-muted">{a.project.code}</div></> : <span className="text-muted">{a.location}</span>}</Td>
                  <Td className="text-muted">{a.condition}</Td>
                  <Td right>{rupiahShort(a.bookValue)}</Td>
                  <Td><Badge status={a.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {sel && <AssetModal id={sel} canWrite={w} onClose={() => setSel(null)} onDone={reload} />}
      {create && <CreateAsset onClose={() => setCreate(false)} onDone={reload} />}
    </div>
  );
}

function AssetModal({ id, canWrite, onClose, onDone }: { id: string; canWrite: boolean; onClose: () => void; onDone: () => void }) {
  const { data: a, reload } = useApi<any>(`/assets/${id}`);
  const { data: projects } = useApi<any[]>('/projects');
  const [projectId, setProjectId] = useState('');
  const [m, setM] = useState({ type: 'PREVENTIVE', description: '', scheduledAt: today(), cost: '' });
  const [busy, setBusy] = useState('');
  async function act(key: string, path: string, body: any, msg: string) {
    setBusy(key);
    try {
      await api(path, { body });
      toast.success(msg);
      reload();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }
  if (!a) return <Modal open onClose={onClose} title="Aset"><Loading /></Modal>;
  const active = !['RETIRED', 'DISPOSED'].includes(a.status);
  return (
    <Modal open onClose={onClose} title={`${a.assetTag} — ${a.name}`} wide>
      <div className="mb-5"><Badge status={a.status} /></div>
      <KV cols={4} items={[['Kategori', a.category], ['Kepemilikan', a.ownership === 'OWNED' ? 'Milik sendiri' : 'Sewa'], ['Harga perolehan', rupiah(a.acquisitionCost)], ['Tanggal perolehan', date(a.acquisitionDate)], ['Lokasi', a.projectName ?? a.location], ['Penanggung jawab', a.custodian], ['Kondisi', a.condition], ['Umur manfaat', `${a.usefulLifeMonths} bulan`]]} />

      {canWrite && active && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <h4 className="mb-3 text-sm font-semibold">{a.projectId ? 'Transfer / kembalikan' : 'Alokasikan ke proyek'}</h4>
            <div className="flex gap-2">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Proyek tujuan">
                <option value="">Pilih proyek</option>
                {projects?.filter((p) => p.id !== a.projectId && ['SETUP', 'ACTIVE', 'COMPLETION'].includes(p.status)).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </Select>
              <Button disabled={!projectId || a.status === 'IN_MAINTENANCE'} loading={busy === 'as'} onClick={() => act('as', `/assets/${id}/assign`, { projectId }, a.projectId ? 'Aset ditransfer' : 'Aset dialokasikan')}>{a.projectId ? 'Transfer' : 'Alokasikan'}</Button>
            </div>
            {a.status === 'ASSIGNED' && <Button variant="ghost" size="sm" className="mt-2" loading={busy === 'rt'} onClick={() => act('rt', `/assets/${id}/return`, {}, 'Aset kembali ke gudang')}>Kembalikan ke gudang</Button>}
          </div>
          <div className="rounded-lg border border-line p-4">
            <h4 className="mb-3 text-sm font-semibold">Jadwalkan maintenance</h4>
            <div className="grid grid-cols-2 gap-2">
              <Select value={m.type} onChange={(e) => setM({ ...m, type: e.target.value })} aria-label="Jenis"><option value="PREVENTIVE">Preventif</option><option value="CORRECTIVE">Perbaikan</option><option value="INSPECTION">Inspeksi</option></Select>
              <Input type="date" value={m.scheduledAt} onChange={(e) => setM({ ...m, scheduledAt: e.target.value })} aria-label="Tanggal" />
              <Input className="col-span-2" placeholder="Uraian pekerjaan" value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} />
              <Input type="number" placeholder="Biaya (Rp)" value={m.cost} onChange={(e) => setM({ ...m, cost: e.target.value })} />
              <Button disabled={!m.description} loading={busy === 'm'} onClick={() => act('m', `/assets/${id}/maintenance`, { ...m, cost: m.cost || undefined }, 'Maintenance dijadwalkan')}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6"><Attachments compact entityType="Asset" entityId={id} canUpload={canWrite} title="Foto & dokumen aset (BPKB, manual, serah terima)" /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold">Riwayat perpindahan</h4>
          {a.movements.length === 0 ? <p className="text-sm text-muted">Belum pernah dipindahkan.</p> : (
            <ol className="space-y-3 border-l border-line pl-4">
              {a.movements.map((mv: any) => (
                <li key={mv.id} className="text-sm">
                  <span className="font-medium">{MOVE[mv.type]}</span> <span className="text-muted">{mv.fromName} ke {mv.toName}</span>
                  <div className="text-xs text-faint">{dateTime(mv.movedAt)}{mv.notes ? ` — ${mv.notes}` : ''}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Maintenance</h4>
          {a.maintenances.length === 0 ? <p className="text-sm text-muted">Belum ada catatan.</p> : (
            <ul className="space-y-2">
              {a.maintenances.map((x: any) => (
                <li key={x.id} className="flex items-start justify-between gap-3 rounded-lg bg-canvas px-3 py-2 text-sm">
                  <div><div className="font-medium">{x.description}</div><div className="text-xs text-muted">{date(x.scheduledAt)} — {rupiah(x.cost)}</div></div>
                  {x.completedAt ? <Badge label="Selesai" tone="ok" /> : canWrite ? (
                    <Button size="sm" variant="secondary" loading={busy === x.id} onClick={() => act(x.id, `/assets/${id}/maintenance/${x.id}/complete`, {}, 'Maintenance selesai')}>Tandai selesai</Button>
                  ) : <Badge label="Terjadwal" tone="warn" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CreateAsset({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ assetTag: '', name: '', category: 'Alat Berat', serialNumber: '', ownership: 'OWNED', acquisitionCost: '', acquisitionDate: today() });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setSaving(true);
    try {
      const body: any = { ...f, assetTag: f.assetTag.toUpperCase() };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      await api('/assets', { body });
      toast.success('Aset terdaftar');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Daftarkan aset" footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!f.assetTag || !f.name}>Simpan</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tag aset" hint="Huruf besar & angka, mis. EXC-003"><Input value={f.assetTag} onChange={set('assetTag')} /></Field>
        <Field label="Kategori"><Select value={f.category} onChange={set('category')}>{['Alat Berat', 'Kendaraan', 'Peralatan', 'Survey', 'IT'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Nama" className="sm:col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Nomor seri"><Input value={f.serialNumber} onChange={set('serialNumber')} /></Field>
        <Field label="Kepemilikan"><Select value={f.ownership} onChange={set('ownership')}><option value="OWNED">Milik sendiri</option><option value="RENTAL">Sewa</option></Select></Field>
        <Field label="Harga perolehan"><Input type="number" value={f.acquisitionCost} onChange={set('acquisitionCost')} /></Field>
        <Field label="Tanggal perolehan"><Input type="date" value={f.acquisitionDate} onChange={set('acquisitionDate')} /></Field>
      </div>
    </Modal>
  );
}
