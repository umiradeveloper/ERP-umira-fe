'use client';

import { bulkCreate, clean, ExcelImport } from '@/components/excel-import';
import { CATEGORY_OPTIONS } from '@/lib/excel';
import { ArrowRightLeft, ClipboardCheck, PackageMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/export-button';
import { Badge, Button, Empty, Field, Input, Loading, Modal, PageHeader, Panel, Select, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABEL, dateTime, num, rupiah, rupiahShort, today, toNum } from '@/lib/format';

type Tab = 'stock' | 'moves' | 'warehouses' | 'items';
const MOVE: Record<string, [string, 'ok' | 'info' | 'warn' | 'neutral' | 'bad']> = {
  RECEIPT: ['Terima', 'ok'], ISSUE: ['Pakai', 'info'], TRANSFER_IN: ['Transfer masuk', 'ok'], TRANSFER_OUT: ['Transfer keluar', 'neutral'], ADJUSTMENT: ['Penyesuaian', 'warn'],
};

export default function InventoryPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('stock');
  const [wh, setWh] = useState('');
  const { data: warehouses, reload: reloadWh } = useApi<any[]>('/warehouses');
  const { data: stock, loading, reload } = useApi<any[]>(`/inventory/stock${wh ? `?warehouseId=${wh}` : ''}`);
  const [action, setAction] = useState<'ISSUE' | 'TRANSFER' | 'OPNAME' | null>(null);
  const w = can(user, 'warehouse:write');
  const value = (stock ?? []).reduce((a, s) => a + toNum(s.value), 0);
  const low = (stock ?? []).filter((s) => s.low).length;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Gudang & stok"
        description="Material masuk dari penerimaan PO, keluar saat dipakai di pekerjaan. Nilai persediaan memakai harga rata-rata bergerak."
        actions={
          <>
            <ExportButton path="/exports/stock.xlsx" />
            {w && <Button variant="secondary" icon={<ClipboardCheck className="size-4" />} onClick={() => setAction('OPNAME')}>Stock opname</Button>}
            {w && <Button variant="secondary" icon={<ArrowRightLeft className="size-4" />} onClick={() => setAction('TRANSFER')}>Transfer</Button>}
            {w && <Button icon={<PackageMinus className="size-4" />} onClick={() => setAction('ISSUE')}>Pakai material</Button>}
          </>
        }
      />

      <section className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line [&>*]:bg-surface [&>*]:px-5 [&>*]:py-4">
        <div><div className="text-[13px] text-muted">Nilai persediaan</div><div className="num mt-1 text-[22px] font-semibold">{rupiahShort(value)}</div></div>
        <div><div className="text-[13px] text-muted">Jenis item</div><div className="num mt-1 text-[22px] font-semibold">{new Set((stock ?? []).map((s) => s.itemId)).size}</div></div>
        <div><div className="text-[13px] text-muted">Di bawah minimum</div><div className={`num mt-1 text-[22px] font-semibold ${low ? 'text-warn' : ''}`}>{low}</div></div>
      </section>

      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { value: 'stock', label: 'Posisi stok' }, { value: 'moves', label: 'Kartu stok' }, { value: 'warehouses', label: 'Gudang', count: warehouses?.length }, { value: 'items', label: 'Master item' },
      ]} />

      {tab === 'stock' && (
        <Panel bodyClass="p-0" title={
          <Select className="h-9 w-64" value={wh} onChange={(e) => setWh(e.target.value)} aria-label="Filter gudang">
            <option value="">Semua gudang</option>
            {warehouses?.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
          </Select>
        }>
          {loading && !stock ? <Loading /> : !stock?.length ? <Empty title="Belum ada stok">Stok bertambah saat barang PO diterima ke gudang.</Empty> : (
            <Table>
              <thead><tr><Th>Gudang</Th><Th>Item</Th><Th>Kategori</Th><Th right>Qty</Th><Th right>Minimum</Th><Th right>Harga rata-rata</Th><Th right>Nilai</Th><Th /></tr></thead>
              <tbody>
                {stock.map((s) => (
                  <Tr key={s.id}>
                    <Td className="text-muted">{s.warehouse.code}</Td>
                    <Td><div className="font-medium">{s.item.name}</div><div className="text-xs text-muted">{s.item.code}</div></Td>
                    <Td className="text-muted">{CATEGORY_LABEL[s.item.category]}</Td>
                    <Td right className="font-medium">{num(s.quantity)} <span className="text-muted">{s.item.unit}</span></Td>
                    <Td right className="text-muted">{toNum(s.item.minStock) ? num(s.item.minStock) : '—'}</Td>
                    <Td right>{rupiah(s.avgCost)}</Td>
                    <Td right>{rupiah(s.value)}</Td>
                    <Td>{s.low && <Badge label="Di bawah minimum" tone="warn" />}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
      {tab === 'moves' && <Moves warehouses={warehouses ?? []} />}
      {tab === 'warehouses' && <Warehouses rows={warehouses ?? []} canWrite={w} onDone={reloadWh} />}
      {tab === 'items' && <Items canWrite={w} />}

      {action && <MoveModal type={action} warehouses={warehouses ?? []} onClose={() => setAction(null)} onDone={reload} />}
    </div>
  );
}

function Moves({ warehouses }: { warehouses: any[] }) {
  const [wh, setWh] = useState('');
  const { data, loading } = useApi<any[]>(`/inventory/movements${wh ? `?warehouseId=${wh}` : ''}`);
  return (
    <Panel bodyClass="p-0" title={
      <Select className="h-9 w-64" value={wh} onChange={(e) => setWh(e.target.value)} aria-label="Filter gudang">
        <option value="">Semua gudang</option>
        {warehouses.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
      </Select>
    }>
      {loading && !data ? <Loading /> : !data?.length ? <Empty title="Belum ada mutasi" /> : (
        <Table>
          <thead><tr><Th>Waktu</Th><Th>No.</Th><Th>Gudang</Th><Th>Item</Th><Th>Jenis</Th><Th right>Qty</Th><Th>Keterangan</Th><Th>Oleh</Th></tr></thead>
          <tbody>
            {data.map((m) => (
              <Tr key={m.id}>
                <Td className="whitespace-nowrap text-muted">{dateTime(m.movedAt)}</Td>
                <Td className="num text-xs">{m.number}</Td>
                <Td className="text-muted">{m.warehouse.code}</Td>
                <Td className="font-medium">{m.item.name}</Td>
                <Td><Badge label={MOVE[m.type]?.[0] ?? m.type} tone={MOVE[m.type]?.[1] ?? 'neutral'} /></Td>
                <Td right className={toNum(m.quantity) < 0 ? 'text-bad' : 'text-ok'}>{toNum(m.quantity) > 0 ? '+' : ''}{num(m.quantity)}</Td>
                <Td className="max-w-xs truncate text-xs text-muted">{[m.costCode && `WBS ${m.costCode}`, m.notes].filter(Boolean).join(' — ')}</Td>
                <Td className="text-xs text-muted">{m.createdByName}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

function Warehouses({ rows, canWrite, onDone }: { rows: any[]; canWrite: boolean; onDone: () => void }) {
  const { data: projects } = useApi<any[]>('/projects');
  const [f, setF] = useState({ code: '', name: '', projectId: '', location: '' });
  const pm = new Map((projects ?? []).map((p) => [p.id, p]));
  async function save() {
    try {
      await api('/warehouses', { body: { ...f, code: f.code.toUpperCase(), projectId: f.projectId || undefined, location: f.location || undefined } });
      toast.success('Gudang ditambahkan');
      setF({ code: '', name: '', projectId: '', location: '' });
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel bodyClass="p-0">
        <Table>
          <thead><tr><Th>Kode</Th><Th>Nama</Th><Th>Proyek</Th><Th>Lokasi</Th></tr></thead>
          <tbody>{rows.map((r) => <Tr key={r.id}><Td className="num font-medium">{r.code}</Td><Td>{r.name}</Td><Td className="text-muted">{r.projectId ? pm.get(r.projectId)?.code : 'Gudang umum'}</Td><Td className="text-muted">{r.location}</Td></Tr>)}</tbody>
        </Table>
      </Panel>
      {canWrite && (
        <Panel title="Tambah gudang" actions={
          <ExcelImport
            title="Impor gudang dari Excel"
            templateName="template-gudang"
            columns={[
              { key: 'code', header: 'Kode', required: true },
              { key: 'name', header: 'Nama', required: true, width: 30 },
              { key: 'projectCode', header: 'Kode proyek', note: 'Kosongkan untuk gudang umum', width: 16 },
              { key: 'location', header: 'Lokasi', width: 30 },
            ]}
            refSheets={[{ name: 'Proyek', headers: ['Kode', 'Nama proyek'], rows: (projects ?? []).map((x) => [x.code, x.name]) }]}
            resolve={(r) => {
              if (!r.projectCode) return r;
              const pr = projects?.find((x) => x.code.toUpperCase() === r.projectCode.trim().toUpperCase());
              return pr ? { ...r, projectId: pr.id } : `kode proyek "${r.projectCode}" tidak ditemukan`;
            }}
            onApply={async (rows, _m, lines) => {
              const res = await bulkCreate(rows, lines, (r) => api('/warehouses', { body: clean({ code: r.code.toUpperCase(), name: r.name, projectId: r.projectId, location: r.location }) }));
              onDone();
              return res;
            }}
          />
        }>
          <div className="space-y-4">
            <Field label="Kode"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="SITE-XXX" /></Field>
            <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Gudang site proyek">
              <Select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
                <option value="">Gudang umum</option>
                {projects?.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </Select>
            </Field>
            <Field label="Lokasi"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
            <Button className="w-full" onClick={save} disabled={!f.code || !f.name}>Tambah gudang</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Items({ canWrite }: { canWrite: boolean }) {
  const { data, reload } = useApi<any[]>('/inventory/items');
  const [f, setF] = useState({ code: '', name: '', unit: '', category: 'MATERIAL', minStock: '' });
  async function save() {
    try {
      await api('/inventory/items', { body: { ...f, code: f.code.toUpperCase(), unit: f.unit || undefined, minStock: f.minStock || undefined } });
      toast.success('Item ditambahkan');
      setF({ code: '', name: '', unit: '', category: 'MATERIAL', minStock: '' });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel bodyClass="p-0" subtitle="Item baru otomatis dibuat saat barang PO pertama kali diterima ke gudang">
        <Table>
          <thead><tr><Th>Kode</Th><Th>Nama</Th><Th>Satuan</Th><Th>Kategori</Th><Th right>Minimum</Th></tr></thead>
          <tbody>{data?.map((i) => <Tr key={i.id}><Td className="num">{i.code}</Td><Td className="font-medium">{i.name}</Td><Td className="text-muted">{i.unit}</Td><Td className="text-muted">{CATEGORY_LABEL[i.category]}</Td><Td right>{toNum(i.minStock) ? num(i.minStock) : '—'}</Td></Tr>)}</tbody>
        </Table>
      </Panel>
      {canWrite && (
        <Panel title="Tambah item" actions={
          <ExcelImport
            title="Impor item dari Excel"
            templateName="template-item-gudang"
            columns={[
              { key: 'code', header: 'Kode', required: true },
              { key: 'name', header: 'Nama', required: true, width: 34 },
              { key: 'unit', header: 'Satuan', width: 10 },
              { key: 'category', header: 'Kategori', type: 'enum', options: CATEGORY_OPTIONS },
              { key: 'minStock', header: 'Stok minimum', type: 'number' },
            ]}
            onApply={async (rows, _m, lines) => {
              const res = await bulkCreate(rows, lines, (r) => api('/inventory/items', { body: clean({ code: r.code.toUpperCase(), name: r.name, unit: r.unit, category: r.category || 'MATERIAL', minStock: r.minStock }) }));
              reload();
              return res;
            }}
          />
        }>
          <div className="space-y-4">
            <Field label="Kode"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Satuan"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
              <Field label="Stok minimum"><Input type="number" value={f.minStock} onChange={(e) => setF({ ...f, minStock: e.target.value })} /></Field>
            </div>
            <Field label="Kategori"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORY_LABEL).filter(([k]) => k !== 'TAX').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Button className="w-full" onClick={save} disabled={!f.code || !f.name}>Tambah item</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

const TITLE = { ISSUE: 'Pakai material untuk pekerjaan', TRANSFER: 'Transfer antar gudang', OPNAME: 'Stock opname' };

function MoveModal({ type, warehouses, onClose, onDone }: { type: 'ISSUE' | 'TRANSFER' | 'OPNAME'; warehouses: any[]; onClose: () => void; onDone: () => void }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [toWarehouseId, setTo] = useState('');
  const [costCode, setCostCode] = useState('');
  const [notes, setNotes] = useState('');
  const [movedAt, setMovedAt] = useState(today());
  const { data: stock } = useApi<any[]>(warehouseId ? `/inventory/stock?warehouseId=${warehouseId}` : null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const lines = Object.entries(qty).filter(([, v]) => v !== '' && (type === 'OPNAME' || toNum(v) > 0)).map(([itemId, quantity]) => ({ itemId, quantity }));
      const r = await api('/stock-movements', { body: { type, warehouseId, toWarehouseId: toWarehouseId || undefined, costCode: costCode || undefined, notes: notes || undefined, movedAt, lines } });
      toast.success(`${r.number} tercatat`);
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={TITLE[type]} wide
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!Object.values(qty).some((v) => v !== '') || (type === 'TRANSFER' && !toWarehouseId)}>Simpan</Button></>}>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Field label={type === 'TRANSFER' ? 'Dari gudang' : 'Gudang'}>
          <Select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setQty({}); }}>
            {warehouses.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
          </Select>
        </Field>
        {type === 'TRANSFER' && (
          <Field label="Ke gudang">
            <Select value={toWarehouseId} onChange={(e) => setTo(e.target.value)}>
              <option value="">Pilih gudang tujuan</option>
              {warehouses.filter((x) => x.id !== warehouseId).map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
            </Select>
          </Field>
        )}
        {type === 'ISSUE' && <Field label="WBS / cost code"><Input value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder="mis. B.4" /></Field>}
        <Field label="Tanggal"><Input type="date" value={movedAt} onChange={(e) => setMovedAt(e.target.value)} /></Field>
        <Field label="Keterangan" className={type === 'TRANSFER' ? 'sm:col-span-3' : 'sm:col-span-3'}><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={type === 'ISSUE' ? 'mis. pembesian kolom lantai 3' : ''} /></Field>
      </div>
      {!stock ? <Loading /> : !stock.length ? <p className="text-sm text-muted">Gudang ini belum memiliki stok.</p> : (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="grid grid-cols-[1fr_140px_150px] gap-3 bg-hover px-3 py-2 text-xs font-medium text-muted">
            <span>Item</span><span className="text-right">Tersedia</span><span className="text-right">{type === 'OPNAME' ? 'Hasil hitung fisik' : 'Qty'}</span>
          </div>
          {stock.map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_140px_150px] items-center gap-3 border-t border-line px-3 py-2">
              <span className="text-sm font-medium">{s.item.name}</span>
              <span className="num text-right text-sm text-muted">{num(s.quantity)} {s.item.unit}</span>
              <Input type="number" className="h-9" value={qty[s.itemId] ?? ''} onChange={(e) => setQty({ ...qty, [s.itemId]: e.target.value })} aria-label={`Qty ${s.item.name}`} />
            </div>
          ))}
        </div>
      )}
      {stock && stock.length > 0 && (
        <div className="mt-3 flex justify-end">
          <ExcelImport
            title={`Impor ${TITLE[type].toLowerCase()} dari Excel`}
            templateName={`template-${type.toLowerCase()}`}
            hint="Template berisi stok gudang terpilih. Isi kolom Qty untuk item yang bergerak."
            columns={[
              { key: 'code', header: 'Kode item', required: true, width: 14 },
              { key: 'name', header: 'Nama item', readOnly: true, width: 34 },
              { key: 'available', header: 'Tersedia', type: 'number', readOnly: true },
              { key: 'unit', header: 'Satuan', readOnly: true, width: 10 },
              { key: 'quantity', header: type === 'OPNAME' ? 'Hasil hitung fisik' : 'Qty', type: 'number', required: true },
            ]}
            prefill={stock.map((x) => ({ code: x.item.code, name: x.item.name, available: String(toNum(x.quantity)), unit: x.item.unit ?? '', quantity: '' }))}
            resolve={(r) => {
              const it = stock.find((x) => x.item.code.toUpperCase() === r.code.trim().toUpperCase());
              return it ? { ...r, itemId: it.itemId } : `item "${r.code}" tidak ada di stok gudang ini`;
            }}
            onApply={(rows) => setQty({ ...qty, ...Object.fromEntries(rows.map((r) => [r.itemId, r.quantity])) })}
          />
        </div>
      )}
      {type === 'OPNAME' && <p className="mt-3 text-xs text-muted">Hanya item yang diisi yang disesuaikan. Selisih dicatat sebagai mutasi penyesuaian.</p>}
    </Modal>
  );
}

