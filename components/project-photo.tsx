'use client';

import { Building2, Camera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, apiBlob, apiUpload } from '@/lib/api';
import { Button, cn, Field, Input, Modal } from './ui';

/** Cache URL gambar per file supaya foto yang sama tidak diunduh berulang */
const cache = new Map<string, Promise<string>>();
function load(id: string) {
  if (!cache.has(id)) {
    const p = apiBlob(`/files/${id}/download?inline=1`).then((b) => URL.createObjectURL(b));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

/** Foto proyek; placeholder ikon gedung bila belum ada foto */
export function ProjectPhoto({ fileId, className = 'size-10', alt = '' }: { fileId?: string | null; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (fileId) load(fileId).then((u) => alive && setUrl(u)).catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [fileId]);
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-lg bg-side-2/10 ring-1 ring-inset ring-line', className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-ink-2/50">
          <Building2 className="size-[45%]" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

/** Foto utama proyek + judulnya. Klik → dialog untuk melihat besar, mengganti foto dan mengubah judul. */
export function ProjectPhotoEditor({ projectId, fileId, title, canEdit, onChanged, className = 'size-16' }: {
  projectId: string; fileId?: string | null; title?: string | null; canEdit: boolean; onChanged: () => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!fileId && !canEdit) return <ProjectPhoto fileId={fileId} className={className} />;
  return (
    <>
      <button type="button" title={title || (canEdit ? (fileId ? 'Ganti foto proyek' : 'Tambah foto proyek') : 'Lihat foto')} onClick={() => setOpen(true)}
        className={cn('group relative shrink-0 overflow-hidden rounded-lg', className)}>
        <ProjectPhoto fileId={fileId} className="size-full" alt={title ?? ''} />
        <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="size-5" />
        </span>
      </button>
      {open && <PhotoDialog projectId={projectId} fileId={fileId} title={title} canEdit={canEdit} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </>
  );
}

function PhotoDialog({ projectId, fileId, title, canEdit, onClose, onChanged }: {
  projectId: string; fileId?: string | null; title?: string | null; canEdit: boolean; onClose: () => void; onChanged: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [judul, setJudul] = useState(title ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(f: File) {
    if (!f.type.startsWith('image/')) return toast.error('Pilih file gambar (JPG, PNG atau WEBP)');
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!judul.trim()) setJudul(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 190));
  }

  async function save() {
    setBusy(true);
    try {
      const body: any = { coverTitle: judul.trim() };
      if (file) {
        const fd = new FormData();
        fd.append('entityType', 'Project');
        fd.append('entityId', projectId);
        fd.append('category', 'Foto proyek');
        fd.append('files', file);
        const [row] = await apiUpload<{ id: string }[]>('/files', fd);
        body.coverFileId = row.id;
      }
      await api(`/projects/${projectId}`, { method: 'PATCH', body });
      toast.success('Foto proyek disimpan');
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const has = !!(preview || fileId);
  return (
    <Modal open onClose={onClose} title="Foto proyek" wide
      footer={canEdit ? (
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={save} loading={busy} disabled={!has}>Simpan</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>Tutup</Button>}>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-line bg-hover">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-[50vh] w-full object-contain" />
          ) : fileId ? (
            <ProjectPhoto fileId={fileId} className="aspect-video w-full rounded-none ring-0 [&_img]:object-contain" />
          ) : (
            <button type="button" onClick={() => input.current?.click()} className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-sm text-muted hover:text-ink">
              <Camera className="size-7" />
              Pilih foto proyek (JPG, PNG atau WEBP)
            </button>
          )}
        </div>
        {canEdit ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={<Camera className="size-3.5" />} onClick={() => input.current?.click()}>{has ? 'Ganti foto' : 'Pilih foto'}</Button>
              {file && <span className="truncate text-xs text-muted">{file.name}</span>}
            </div>
            <Field label="Judul foto" hint="Mis. Tampak depan gedung — progres struktur lantai 3">
              <Input value={judul} maxLength={190} onChange={(e) => setJudul(e.target.value)} placeholder="Judul atau keterangan foto" />
            </Field>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
          </>
        ) : (
          title && <p className="text-sm font-medium">{title}</p>
        )}
      </div>
    </Modal>
  );
}
