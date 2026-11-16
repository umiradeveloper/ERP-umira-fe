'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Panel, Tabs, Textarea } from '@/components/ui';
import { api, useApi } from '@/lib/api';
import { dateTime, rupiah } from '@/lib/format';

const LINK: Record<string, string> = { PR: '/procurement/pr/', PO: '/procurement/po/' };
const TYPE: Record<string, string> = { PR: 'Purchase request', PO: 'Purchase order', VO: 'Variation order' };

export default function ApprovalsPage() {
  const { data, error, loading, reload } = useApi<any[]>('/approvals/inbox');
  const [tab, setTab] = useState<'mine' | 'all' | 'sent'>('mine');
  const [act, setAct] = useState<{ row: any; decision: 'APPROVE' | 'REJECT' | 'REVISION' } | null>(null);

  const rows = (data ?? []).filter((r) => (tab === 'mine' ? r.canAct : tab === 'sent' ? r.isMine : true));

  return (
    <div className="animate-rise">
      <PageHeader title="Approval saya" description="Dokumen yang menunggu keputusan Anda. Anda tidak dapat menyetujui dokumen yang Anda ajukan sendiri." />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'mine', label: 'Perlu keputusan saya', count: (data ?? []).filter((r) => r.canAct).length },
        { value: 'sent', label: 'Saya ajukan', count: (data ?? []).filter((r) => r.isMine).length },
        { value: 'all', label: 'Semua yang berjalan', count: data?.length ?? 0 },
      ]} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : rows.length === 0 ? (
        <Panel><Empty title={tab === 'mine' ? 'Tidak ada yang perlu Anda putuskan' : 'Tidak ada dokumen'}>Dokumen baru akan muncul di sini saat diajukan ke role Anda.</Empty></Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted">
                  {TYPE[r.entityType] ?? r.entityType}
                  <span className="text-line-strong">/</span>
                  Langkah {r.currentStep} dari {r.totalSteps}: <span className="font-medium text-ink-2">{r.currentRole}</span>
                </div>
                <Link href={r.link ?? `${LINK[r.entityType] ?? '#'}${r.entityId}`} className="mt-1 block truncate font-medium text-ink hover:underline underline-offset-2">{r.title}</Link>
                <div className="mt-0.5 text-xs text-muted">Diajukan {r.requestedByName}, {dateTime(r.createdAt)}</div>
              </div>
              <div className="num text-right text-lg font-semibold">{rupiah(r.amount)}</div>
              {r.canAct ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAct({ row: r, decision: 'REVISION' })}>Minta revisi</Button>
                  <Button size="sm" variant="danger" onClick={() => setAct({ row: r, decision: 'REJECT' })}>Tolak</Button>
                  <Button size="sm" onClick={() => setAct({ row: r, decision: 'APPROVE' })}>Setujui</Button>
                </div>
              ) : (
                <Badge label={r.isMine ? 'Menunggu approver' : `Menunggu ${r.currentRole}`} tone="warn" />
              )}
            </article>
          ))}
        </div>
      )}
      {act && <DecisionModal {...act} onClose={() => setAct(null)} onDone={reload} />}
    </div>
  );
}

const TITLE = { APPROVE: 'Setujui dokumen', REJECT: 'Tolak dokumen', REVISION: 'Minta revisi' };
const DONE = { APPROVE: 'Disetujui', REJECT: 'Ditolak', REVISION: 'Dikembalikan untuk revisi' };

function DecisionModal({ row, decision, onClose, onDone }: { row: any; decision: 'APPROVE' | 'REJECT' | 'REVISION'; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const required = decision !== 'APPROVE';
  async function save() {
    setSaving(true);
    try {
      const r = await api(`/approvals/${row.id}/decision`, { body: { decision, comment: comment || undefined } });
      toast.success(`${DONE[decision]}${r.status === 'IN_APPROVAL' ? ' — diteruskan ke langkah berikutnya' : ''}`);
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={TITLE[decision]}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button variant={decision === 'REJECT' ? 'danger' : 'primary'} onClick={save} loading={saving} disabled={required && !comment.trim()}>{TITLE[decision]}</Button></>}>
      <p className="mb-4 text-sm text-ink-2">{row.title} — <span className="num font-medium">{rupiah(row.amount)}</span></p>
      <Field label={required ? 'Alasan (wajib)' : 'Komentar (opsional)'}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} autoFocus placeholder={required ? 'Jelaskan apa yang perlu diperbaiki' : 'mis. Budget tersedia'} />
      </Field>
    </Modal>
  );
}
