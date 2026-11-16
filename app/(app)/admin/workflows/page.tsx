'use client';

import { ExcelImport } from '@/components/excel-import';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Loading, PageHeader, Panel, Select } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rupiah } from '@/lib/format';

const NAMES: Record<string, string> = { PR: 'Purchase request', PO: 'Purchase order' };

export default function WorkflowsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useApi<any[]>('/workflows');
  const { data: roles } = useApi<any[]>('/roles');
  return (
    <div className="animate-rise">
      <PageHeader title="Alur approval" description="Atur siapa yang menyetujui dan mulai nominal berapa. Perubahan disimpan sebagai versi baru dan hanya berlaku untuk pengajuan berikutnya." />
      {loading && !data ? <Loading /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          {['PR', 'PO'].map((t) => (
            <WorkflowCard key={t} type={t} wf={data?.find((w) => w.entityType === t)} roles={roles ?? []} canEdit={can(user, 'admin:write')} onSaved={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({ type, wf, roles, canEdit, onSaved }: { type: string; wf: any; roles: any[]; canEdit: boolean; onSaved: () => void }) {
  const [steps, setSteps] = useState<{ roleName: string; minAmount: string }[]>(wf?.steps?.map((s: any) => ({ roleName: s.roleName, minAmount: s.minAmount })) ?? []);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api(`/workflows/${type}`, { method: 'PUT', body: { name: `Approval ${NAMES[type]}`, steps } });
      toast.success(`Workflow ${NAMES[type]} disimpan sebagai versi baru`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Panel title={NAMES[type]} subtitle={wf ? `Versi ${wf.version} aktif` : 'Belum diatur — semua pengajuan disetujui otomatis'}
      actions={canEdit && <Button size="sm" onClick={save} loading={saving} disabled={!steps.length}>Simpan versi baru</Button>}>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-signal text-xs font-semibold text-white">{i + 1}</span>
            {canEdit ? (
              <>
                <Select className="h-9" value={s.roleName} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, roleName: e.target.value } : x)))} aria-label="Role approver">
                  {roles.map((r) => <option key={r.id}>{r.name}</option>)}
                </Select>
                <span className="whitespace-nowrap text-xs text-muted">jika ≥</span>
                <Input type="number" className="h-9 w-40" value={s.minAmount} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, minAmount: e.target.value } : x)))} aria-label="Nominal minimum" />
                <button onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="rounded p-1 text-faint hover:text-bad" aria-label="Hapus langkah"><Trash2 className="size-4" /></button>
              </>
            ) : (
              <span className="text-sm"><b>{s.roleName}</b> <span className="text-muted">untuk nilai ≥ {rupiah(s.minAmount)}</span></span>
            )}
          </li>
        ))}
      </ol>
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setSteps([...steps, { roleName: roles[0]?.name ?? '', minAmount: '0' }])}>Tambah langkah</Button>
          <ExcelImport
            variant="ghost"
            title={`Impor langkah approval ${NAMES[type]}`}
            templateName={`workflow-${type.toLowerCase()}`}
            modes
            columns={[
              { key: 'roleName', header: 'Role approver', type: 'enum', required: true, options: roles.map((r) => ({ value: r.name, label: r.name })), width: 24 },
              { key: 'minAmount', header: 'Nominal minimum', type: 'number', width: 20 },
            ]}
            prefill={steps.map((x) => ({ roleName: x.roleName, minAmount: String(x.minAmount) }))}
            onApply={(rows, mode) => {
              const add = rows.map((r) => ({ roleName: r.roleName, minAmount: r.minAmount || '0' }));
              setSteps(mode === 'replace' ? add : [...steps, ...add]);
            }}
          />
        </div>
      )}
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Langkah dengan nominal minimum di atas nilai dokumen dilewati. Pengaju tidak dapat menyetujui dokumennya sendiri.</p>
    </Panel>
  );
}
