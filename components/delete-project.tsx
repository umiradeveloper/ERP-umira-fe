'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Field, Input, Loading, Modal } from './ui';

type Check = {
  project: { id: string; code: string; name: string };
  canDelete: boolean;
  blockers: string[];
  willDelete: { rab: number; rap: number; progress: number; dailyReports: number; variationOrders: number; purchaseRequests: number; rfqs: number; files: number };
  tender: string | null;
};

const LABEL: [keyof Check['willDelete'], string][] = [
  ['rab', 'baris RAB'], ['rap', 'baris RAP'], ['progress', 'catatan progres'], ['dailyReports', 'laporan harian'],
  ['variationOrders', 'variation order'], ['purchaseRequests', 'purchase request'], ['rfqs', 'RFQ'], ['files', 'dokumen & foto proyek'],
];

/** Tombol + dialog hapus proyek (khusus Administrator). Proyek dengan transaksi keuangan/stok tidak bisa dihapus. */
export function DeleteProject({ projectId, status, onCancelled }: { projectId: string; status: string; onCancelled: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>Hapus</Button>
      {open && <DeleteDialog projectId={projectId} status={status} onClose={() => setOpen(false)} onCancelled={onCancelled} />}
    </>
  );
}

function DeleteDialog({ projectId, status, onClose, onCancelled }: { projectId: string; status: string; onClose: () => void; onCancelled: () => void }) {
  const router = useRouter();
  const [c, setC] = useState<Check | null>(null);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Check>(`/projects/${projectId}/delete-check`).then(setC).catch((e) => setErr(e.message));
  }, [projectId]);

  async function remove() {
    if (!c) return;
    setBusy(true);
    try {
      await api(`/projects/${projectId}?confirm=${encodeURIComponent(code.trim())}`, { method: 'DELETE' });
      toast.success(`Proyek ${c.project.code} dihapus`);
      router.replace('/projects');
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  }

  async function cancelProject() {
    setBusy(true);
    try {
      await api(`/projects/${projectId}`, { method: 'PATCH', body: { status: 'CANCELLED' } });
      toast.success('Status proyek diubah menjadi Batal');
      onCancelled();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  }

  const canCancel = ['SETUP', 'ON_HOLD'].includes(status);
  const items = c ? LABEL.filter(([k]) => c.willDelete[k] > 0) : [];
  const match = !!c && code.trim().toUpperCase() === c.project.code.toUpperCase();

  return (
    <Modal open onClose={onClose} title="Hapus proyek"
      footer={
        !c ? <Button variant="secondary" onClick={onClose}>Tutup</Button>
        : c.canDelete ? (
          <>
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button variant="danger" className="!bg-bad !text-white hover:!brightness-95" disabled={!match} loading={busy} onClick={remove}>Hapus permanen</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Tutup</Button>
            {canCancel && <Button onClick={cancelProject} loading={busy}>Ubah status jadi Batal</Button>}
          </>
        )
      }>
      {err ? <p className="text-sm text-bad">{err}</p> : !c ? <Loading /> : c.canDelete ? (
        <div className="space-y-4 text-sm">
          <div className="flex gap-3 rounded-lg bg-bad-soft px-3 py-2.5 text-bad">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Proyek <b>{c.project.code} — {c.project.name}</b> akan dihapus permanen dan tidak bisa dikembalikan.</span>
          </div>
          {items.length > 0 ? (
            <div>
              <p className="mb-1.5 text-muted">Ikut terhapus:</p>
              <ul className="list-inside list-disc space-y-0.5">
                {items.map(([k, l]) => <li key={k}><span className="num">{c.willDelete[k]}</span> {l}</li>)}
              </ul>
            </div>
          ) : <p className="text-muted">Proyek ini belum punya data turunan.</p>}
          {c.tender && <p className="text-muted">Tender {c.tender} tetap ada (status Menang), tetapi tidak lagi terhubung ke proyek.</p>}
          <Field label={`Ketik kode proyek ${c.project.code} untuk konfirmasi`}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={c.project.code} autoFocus autoComplete="off" />
          </Field>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex gap-3 rounded-lg bg-warn-soft px-3 py-2.5 text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Proyek <b>{c.project.code}</b> tidak bisa dihapus karena sudah punya {c.blockers.join(', ')}.</span>
          </div>
          <p className="text-muted">
            Supaya riwayat keuangan dan stok tetap utuh, proyek seperti ini tidak dihapus tetapi dibatalkan.
            {canCancel ? '' : ' Proyek yang sedang berjalan perlu ditunda dulu sebelum bisa dibatalkan.'}
          </p>
        </div>
      )}
    </Modal>
  );
}
