'use client';

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { downloadTemplate, parseExcelFile, type ExcelCol, type ParseResult, type RefSheet, type Row } from '@/lib/excel';
import { Button, cn, Modal } from './ui';

export type ImportMode = 'append' | 'replace';
export type BulkResult = { ok: number; failed: { line: number; message: string }[] };

/**
 * Tombol "Impor Excel" + dialog: unduh template, unggah file, pratinjau, lalu terapkan.
 * - Untuk form multi-baris: onApply(rows, mode) mengisi form (user tetap meninjau sebelum menyimpan).
 * - Untuk data master: onApply mengembalikan BulkResult setelah membuat data satu per satu.
 */
export function ExcelImport({
  title,
  templateName,
  columns,
  onApply,
  prefill,
  refSheets,
  modes = false,
  label = 'Impor Excel',
  size = 'sm',
  variant = 'secondary',
  hint,
  resolve,
}: {
  title: string;
  templateName: string;
  columns: ExcelCol[];
  onApply: (rows: Row[], mode: ImportMode, lines: number[]) => void | BulkResult | Promise<void | BulkResult>;
  /** Isi awal template (mis. daftar item yang tinggal diisi harga) — boleh fungsi async */
  prefill?: Row[] | (() => Row[] | Promise<Row[]>);
  refSheets?: RefSheet[] | (() => RefSheet[] | Promise<RefSheet[]>);
  /** Tampilkan pilihan Tambahkan / Ganti semua baris */
  modes?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'secondary' | 'ghost' | 'primary';
  hint?: string;
  /** Validasi/konversi tambahan per baris (mis. kode akun → id). Kembalikan string untuk error. */
  resolve?: (row: Row) => Row | string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size={size} variant={variant} icon={<FileSpreadsheet className="size-3.5" />} onClick={() => setOpen(true)}>{label}</Button>
      {open && (
        <ImportDialog
          title={title} templateName={templateName} columns={columns} onApply={onApply} prefill={prefill} refSheets={refSheets}
          modes={modes} hint={hint} resolve={resolve} onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ImportDialog({ title, templateName, columns, onApply, prefill, refSheets, modes, hint, resolve, onClose }: {
  title: string; templateName: string; columns: ExcelCol[]; onApply: any; prefill?: any; refSheets?: any; modes: boolean; hint?: string;
  resolve?: (row: Row) => Row | string; onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [busy, setBusy] = useState<'' | 'tpl' | 'read' | 'apply'>('');
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { line: number; message: string }[] } | null>(null);
  const visible = columns;

  async function template() {
    setBusy('tpl');
    try {
      const pre = typeof prefill === 'function' ? await prefill() : prefill;
      const refs = typeof refSheets === 'function' ? await refSheets() : refSheets;
      await downloadTemplate({ fileName: templateName, title, columns, prefill: pre, refSheets: refs });
    } catch (e: any) {
      toast.error(e.message ?? 'Gagal membuat template');
    } finally {
      setBusy('');
    }
  }

  async function read(f: File) {
    setFile(f);
    setErr('');
    setParsed(null);
    setResult(null);
    setBusy('read');
    try {
      const r = await parseExcelFile(f, columns);
      if (resolve) {
        const rows: Row[] = [];
        const lines: number[] = [];
        r.rows.forEach((row, i) => {
          const x = resolve(row);
          if (typeof x === 'string') r.errors.push(`Baris ${r.lines[i]}: ${x}`);
          else { rows.push(x); lines.push(r.lines[i]); }
        });
        r.rows = rows;
        r.lines = lines;
      }
      setParsed(r);
    } catch (e: any) {
      setErr(e.message ?? 'File tidak bisa dibaca');
    } finally {
      setBusy('');
    }
  }

  async function apply() {
    if (!parsed?.rows.length) return;
    setBusy('apply');
    try {
      const res = await onApply(parsed.rows, mode, parsed.lines);
      if (res && typeof res === 'object' && 'ok' in res) {
        setResult(res);
        if (!res.failed.length) {
          toast.success(`${res.ok} data berhasil diimpor`);
          onClose();
        }
      } else {
        toast.success(`${parsed.rows.length} baris dimasukkan ke form. Periksa lalu simpan.`);
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  const fmt = (c: ExcelCol, v: string) => (c.type === 'enum' ? c.options?.find((o) => o.value === v)?.label ?? v : (c.type === 'number' || c.type === 'integer') && v !== '' ? Number(v).toLocaleString('id-ID') : v);

  return (
    <Modal open onClose={onClose} title={title} wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{result ? 'Tutup' : 'Batal'}</Button>
          {!result && <Button onClick={apply} loading={busy === 'apply'} disabled={!parsed?.rows.length}>Impor {parsed?.rows.length ? `${parsed.rows.length} baris` : ''}</Button>}
        </>
      }>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-hover px-4 py-3">
          <div className="text-sm">
            <div className="font-medium">1. Unduh template</div>
            <div className="text-xs text-muted">{hint ?? 'Isi sheet "Data". Sheet "Petunjuk" menjelaskan setiap kolom.'}</div>
          </div>
          <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />} onClick={template} loading={busy === 'tpl'}>Unduh template</Button>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">2. Unggah file yang sudah diisi</div>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) read(f); }}
            className={cn('flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors', drag ? 'border-signal bg-signal-soft' : 'border-line-strong hover:border-ink-2 hover:bg-hover')}
          >
            <Upload className="size-5 text-muted" />
            <span className="font-medium">{file ? file.name : 'Pilih atau seret file .xlsx ke sini'}</span>
            <span className="text-xs text-muted">{busy === 'read' ? 'Membaca file…' : 'Hanya .xlsx'}</span>
          </button>
          <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
        </div>

        {err && <div className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2.5 text-sm text-bad"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{err}</div>}

        {parsed && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-ok"><CheckCircle2 className="size-4" />{parsed.rows.length} baris siap diimpor</span>
              {parsed.errors.length > 0 && <span className="inline-flex items-center gap-1.5 text-bad"><AlertTriangle className="size-4" />{parsed.errors.length} baris bermasalah (dilewati)</span>}
            </div>
            {parsed.errors.length > 0 && (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">
                {parsed.errors.slice(0, 100).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {parsed.rows.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-hover text-muted">
                    <tr>{visible.map((c) => <th key={c.key} className={cn('whitespace-nowrap px-2 py-1.5 text-left font-medium', (c.type === 'number' || c.type === 'integer') && 'text-right')}>{c.header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-line">
                        {visible.map((c) => <td key={c.key} className={cn('max-w-[220px] truncate px-2 py-1.5', (c.type === 'number' || c.type === 'integer') && 'num text-right')}>{fmt(c, r[c.key] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 50 && <div className="border-t border-line px-2 py-1.5 text-xs text-muted">…dan {parsed.rows.length - 50} baris lainnya</div>}
              </div>
            )}
            {modes && parsed.rows.length > 0 && (
              <div className="flex gap-2">
                {([['append', 'Tambahkan ke baris yang ada'], ['replace', 'Ganti semua baris']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setMode(v)} className={cn('rounded-lg border px-3 py-2 text-[13px] font-medium', mode === v ? 'border-ink bg-ink text-white' : 'border-line-strong hover:border-ink')}>{l}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-lg border border-line px-3 py-2.5 text-sm">
            <div className="text-ok">{result.ok} data berhasil diimpor</div>
            {result.failed.length > 0 && (
              <>
                <div className="text-bad">{result.failed.length} gagal:</div>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-bad">
                  {result.failed.map((f, i) => <li key={i}>Baris {f.line}: {f.message}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Jalankan create satu per satu untuk impor data master; kumpulkan yang gagal. */
export async function bulkCreate(rows: Row[], lines: number[], fn: (row: Row) => Promise<unknown>): Promise<BulkResult> {
  const failed: BulkResult['failed'] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    try {
      await fn(rows[i]);
      ok++;
    } catch (e: any) {
      failed.push({ line: lines[i], message: e.message ?? 'Gagal' });
    }
  }
  return { ok, failed };
}

/** Hilangkan field kosong agar validasi backend (opsional) tidak menolak "" */
export const clean = <T extends Record<string, any>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined)) as Partial<T>;
