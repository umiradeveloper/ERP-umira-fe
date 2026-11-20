'use client';

import { Building2, Camera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, apiBlob, apiUpload } from '@/lib/api';
import { cn } from './ui';

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

/** Foto proyek yang bisa diganti (klik → pilih gambar → unggah → jadikan foto proyek) */
export function ProjectPhotoEditor({ projectId, fileId, canEdit, onChanged, className = 'size-16' }: {
  projectId: string; fileId?: string | null; canEdit: boolean; onChanged: () => void; className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(f: File) {
    if (!f.type.startsWith('image/')) return toast.error('Pilih file gambar (JPG, PNG atau WEBP)');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('entityType', 'Project');
      fd.append('entityId', projectId);
      fd.append('category', 'Foto proyek');
      fd.append('files', f);
      const [row] = await apiUpload<{ id: string }[]>('/files', fd);
      await api(`/projects/${projectId}`, { method: 'PATCH', body: { coverFileId: row.id } });
      toast.success('Foto proyek diperbarui');
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return <ProjectPhoto fileId={fileId} className={className} />;
  return (
    <>
      <button type="button" title={fileId ? 'Ganti foto proyek' : 'Tambah foto proyek'} onClick={() => input.current?.click()} disabled={busy}
        className={cn('group relative shrink-0 overflow-hidden rounded-lg', className)}>
        <ProjectPhoto fileId={fileId} className="size-full" />
        <span className={cn('absolute inset-0 flex items-center justify-center bg-ink/55 text-white transition-opacity', busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
          <Camera className={cn('size-5', busy && 'animate-pulse')} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
    </>
  );
}
