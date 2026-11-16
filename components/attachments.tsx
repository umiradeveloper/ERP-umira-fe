'use client';

import { FileText, ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal, Panel, cn } from './ui';
import { api, apiBlob, apiDownload, apiUpload, useApi } from '@/lib/api';
import { dateTime } from '@/lib/format';

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Thumbnail gambar yang dimuat lewat API (butuh header auth) */
function Thumb({ id, alt, onOpen }: { id: string; alt: string; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    apiBlob(`/files/${id}/download?inline=1`).then((b) => setUrl((u = URL.createObjectURL(b)))).catch(() => {});
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return (
    <button onClick={() => url && onOpen(url)} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-canvas ring-1 ring-line" aria-label={`Lihat ${alt}`}>
      {url ? <img src={url} alt={alt} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" /> : <ImageIcon className="m-auto size-5 text-faint" />}
    </button>
  );
}

/**
 * Lampiran dokumen/foto untuk transaksi apa pun (PRD §5.14).
 * Foto tampil sebagai galeri, dokumen lain sebagai daftar.
 */
export function Attachments({ entityType, entityId, canUpload = true, title = 'Lampiran', category, compact }: {
  entityType: string; entityId: string; canUpload?: boolean; title?: string; category?: string; compact?: boolean;
}) {
  const { data, reload } = useApi<any[]>(`/files?entityType=${entityType}&entityId=${entityId}`);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const images = (data ?? []).filter((f) => f.mimeType.startsWith('image/'));
  const docs = (data ?? []).filter((f) => !f.mimeType.startsWith('image/'));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    fd.append('entityType', entityType);
    fd.append('entityId', entityId);
    if (category) fd.append('category', category);
    Array.from(files).forEach((f) => fd.append('files', f));
    setBusy(true);
    try {
      const r = await apiUpload<any[]>('/files', fd);
      toast.success(`${r.length} file diunggah`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function remove(id: string) {
    try {
      await api(`/files/${id}`, { method: 'DELETE' });
      toast.success('File dihapus');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const body = (
    <div
      onDragOver={(e) => { if (canUpload) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (canUpload) upload(e.dataTransfer.files); }}
      className={cn('rounded-lg transition-colors', drag && 'bg-signal-soft ring-2 ring-signal')}
    >
      {!data?.length ? (
        <p className="py-3 text-sm text-muted">
          {canUpload ? 'Belum ada lampiran. Seret file ke sini atau klik Unggah — foto, PDF, Excel, Word, maks 15 MB.' : 'Belum ada lampiran.'}
        </p>
      ) : (
        <div className="space-y-4">
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((f) => <Thumb key={f.id} id={f.id} alt={f.fileName} onOpen={setPreview} />)}
            </div>
          )}
          {docs.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {docs.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <FileText className="size-4 shrink-0 text-muted" />
                  <button className="min-w-0 flex-1 truncate text-left font-medium hover:underline underline-offset-2" onClick={() => apiDownload(`/files/${f.id}/download`, f.fileName).catch((e) => toast.error(e.message))}>
                    {f.fileName}
                  </button>
                  <span className="hidden text-xs text-muted sm:inline">{kb(f.size)} — {f.uploadedByName}, {dateTime(f.createdAt)}</span>
                  {canUpload && (
                    <button onClick={() => remove(f.id)} className="rounded p-1 text-faint hover:bg-bad-soft hover:text-bad" aria-label={`Hapus ${f.fileName}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} accept="image/*,.pdf,.xlsx,.xls,.docx,.doc,.csv,.zip,.dwg" />
    </div>
  );

  const action = canUpload && (
    <Button size="sm" variant="secondary" loading={busy} icon={<Upload className="size-3.5" />} onClick={() => input.current?.click()}>Unggah</Button>
  );

  return (
    <>
      {compact ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold"><Paperclip className="size-3.5" />{title}</span>
            {action}
          </div>
          {body}
        </div>
      ) : (
        <Panel title={title} actions={action}>{body}</Panel>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Pratinjau foto" wide>
        {preview && <img src={preview} alt="" className="mx-auto max-h-[70vh] rounded-lg" />}
      </Modal>
    </>
  );
}
