'use client';

import { ExcelImport } from './excel-import';
import { CATEGORY_OPTIONS } from '@/lib/excel';
import { Plus, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { ApprovalTimeline } from './approval-timeline';
import { Attachments } from './attachments';
import { Badge, Button, Empty, Field, Input, Loading, Modal, Panel, Select, Table, Td, Textarea, Th, Tr } from './ui';
import { api, useApi } from '@/lib/api';
import { CATEGORY_LABEL, date, rupiah, toNum } from '@/lib/format';

type Item = { category: string; description: string; amount: string };

/** Variation order proyek: perubahan nilai kontrak & budget lewat approval, dengan histori revisi budget */
export function VariationOrders({ projectId, canWrite, onChanged }: { projectId: string; canWrite: boolean; onChanged: () => void }) {
  const { data, loading, reload } = useApi<any>(`/projects/${projectId}/variation-orders`);
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState('');

  async function submit(id: string) {
    setBusy(id);
    try {
      const r = await api(`/variation-orders/${id}/submit`, { body: {} });
      toast.success(r.status === 'APPROVED' ? 'VO disetujui otomatis' : 'VO diajukan ke approver');
      reload();
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  if (loading && !data) return <Loading />;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
      <Panel title="Variation order" subtitle="Tambah/kurang pekerjaan. Setelah disetujui, nilai kontrak berubah dan budget baseline baru dibuat." bodyClass="p-0"
        actions={canWrite && <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setEdit({})}>VO baru</Button>}>
        {!data?.items.length ? <Empty title="Belum ada variation order" /> : (
          <Table>
            <thead><tr><Th>Nomor</Th><Th>Judul</Th><Th right>Δ Kontrak</Th><Th right>Δ Budget</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {data.items.map((v: any) => (
                <Fragment key={v.id}>
                  <Tr onClick={() => setOpen(open === v.id ? null : v.id)}>
                    <Td className="whitespace-nowrap font-medium">{v.number}</Td>
                    <Td><div>{v.title}</div><div className="text-xs text-muted">{date(v.createdAt)}</div></Td>
                    <Td right className={toNum(v.contractChange) < 0 ? 'text-bad' : 'text-ok'}>{toNum(v.contractChange) >= 0 ? '+' : '−'}{rupiah(Math.abs(toNum(v.contractChange)))}</Td>
                    <Td right>{toNum(v.budgetChange) >= 0 ? '+' : '−'}{rupiah(Math.abs(toNum(v.budgetChange)))}</Td>
                    <Td><Badge status={v.status} /></Td>
                    <Td right>
                      {canWrite && ['DRAFT', 'REVISION'].includes(v.status) && (
                        <span className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => setEdit(v)}>Ubah</Button>
                          <Button size="sm" loading={busy === v.id} onClick={() => submit(v.id)}>Ajukan</Button>
                        </span>
                      )}
                    </Td>
                  </Tr>
                  {open === v.id && (
                    <tr>
                      <td colSpan={6} className="border-b border-line bg-hover/60 px-5 py-4">
                        <div className="grid gap-5 lg:grid-cols-2">
                          <div>
                            {v.description && <p className="mb-3 text-sm text-ink-2">{v.description}</p>}
                            <ul className="space-y-1.5 text-sm">
                              {v.items.map((i: any) => (
                                <li key={i.id} className="flex justify-between gap-3"><span><span className="text-muted">{CATEGORY_LABEL[i.category]}</span> — {i.description}</span><span className="num">{rupiah(i.amount)}</span></li>
                              ))}
                            </ul>
                            <div className="mt-4"><Attachments compact entityType="VariationOrder" entityId={v.id} canUpload={canWrite} title="Dokumen pendukung" /></div>
                          </div>
                          <ApprovalTimeline entityType="VO" entityId={v.id} refreshKey={v.status} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <Panel title="Histori budget baseline">
        <ol className="space-y-3">
          {data?.budgetHistory.map((b: any, i: number) => (
            <li key={b.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">Revisi {b.revision}{i === data.budgetHistory.length - 1 && <span className="ml-2"><Badge label="Berlaku" tone="ok" /></span>}</div>
                <div className="text-xs text-muted">{b.name}</div>
              </div>
              <span className="num whitespace-nowrap font-medium">{rupiah(b.total)}</span>
            </li>
          ))}
        </ol>
      </Panel>
      {edit && <VoForm projectId={projectId} vo={edit} onClose={() => setEdit(null)} onDone={() => { reload(); onChanged(); }} />}
    </div>
  );
}

function VoForm({ projectId, vo, onClose, onDone }: { projectId: string; vo: any; onClose: () => void; onDone: () => void }) {
  const isNew = !vo.id;
  const [title, setTitle] = useState(vo.title ?? '');
  const [description, setDescription] = useState(vo.description ?? '');
  const [contractChange, setContract] = useState(vo.contractChange ? String(toNum(vo.contractChange)) : '');
  const [items, setItems] = useState<Item[]>(vo.items?.map((i: any) => ({ category: i.category, description: i.description, amount: String(toNum(i.amount)) })) ?? [{ category: 'MATERIAL', description: '', amount: '' }]);
  const [saving, setSaving] = useState(false);
  const budget = items.reduce((a, i) => a + toNum(i.amount), 0);
  const upd = (k: number, f: keyof Item, v: string) => setItems(items.map((x, i) => (i === k ? { ...x, [f]: v } : x)));

  async function save() {
    setSaving(true);
    try {
      const body = { title, description: description || undefined, contractChange: contractChange || '0', items: items.filter((i) => i.description && i.amount).map((i) => ({ ...i, amount: i.amount })) };
      await api(isNew ? `/projects/${projectId}/variation-orders` : `/variation-orders/${vo.id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast.success(isNew ? 'VO tersimpan sebagai draft' : 'VO diperbarui');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Variation order baru' : `Ubah ${vo.number}`} wide
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={save} loading={saving} disabled={!title}>Simpan draft</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Judul" className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
        <Field label="Perubahan nilai kontrak (Rp)" hint="Negatif untuk pekerjaan kurang"><Input type="number" value={contractChange} onChange={(e) => setContract(e.target.value)} /></Field>
        <Field label="Dasar / keterangan" className="sm:col-span-3"><Textarea className="min-h-14" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="mis. surat instruksi owner No. …" /></Field>
      </div>
      <div className="mt-5 text-[13px] font-medium text-ink-2">Perubahan budget biaya</div>
      <div className="mt-2 space-y-2">
        {items.map((i, k) => (
          <div key={k} className="grid grid-cols-[140px_1fr_170px_32px] gap-2">
            <Select className="h-9 text-[13px]" value={i.category} onChange={(e) => upd(k, 'category', e.target.value)} aria-label="Kategori">
              {Object.entries(CATEGORY_LABEL).filter(([c]) => c !== 'TAX').map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </Select>
            <Input className="h-9 text-[13px]" placeholder="Uraian" value={i.description} onChange={(e) => upd(k, 'description', e.target.value)} />
            <Input type="number" className="h-9 text-[13px]" placeholder="Nilai (boleh negatif)" value={i.amount} onChange={(e) => upd(k, 'amount', e.target.value)} />
            <button disabled={items.length === 1} onClick={() => setItems(items.filter((_, x) => x !== k))} className="rounded p-1 text-faint hover:text-bad disabled:opacity-30" aria-label="Hapus baris"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setItems([...items, { category: 'MATERIAL', description: '', amount: '' }])}>Tambah baris</Button>
          <ExcelImport
            title="Impor perubahan budget dari Excel"
            templateName="template-vo"
            modes
            columns={[
              { key: 'category', header: 'Kategori', type: 'enum', required: true, options: CATEGORY_OPTIONS },
              { key: 'description', header: 'Uraian', required: true, width: 40 },
              { key: 'amount', header: 'Nilai', type: 'number', required: true, width: 18, note: 'Negatif untuk pekerjaan kurang' },
            ]}
            onApply={(rows, mode) => {
              const add = rows.map((r) => ({ category: r.category, description: r.description, amount: r.amount }));
              setItems(mode === 'replace' ? add : [...items.filter((x) => x.description.trim()), ...add]);
            }}
          />
        </div>
        <div className="num text-sm">Δ budget <b>{rupiah(budget)}</b> — margin VO <b className={toNum(contractChange) - budget < 0 ? 'text-bad' : 'text-ok'}>{rupiah(toNum(contractChange) - budget)}</b></div>
      </div>
    </Modal>
  );
}
