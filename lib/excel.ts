'use client';

/**
 * Utilitas impor Excel: membuat template (.xlsx) dan membaca file unggahan.
 * ExcelJS dimuat dinamis supaya tidak memperbesar bundle halaman.
 */

export type ColType = 'text' | 'number' | 'integer' | 'date' | 'enum';
export interface ExcelCol {
  key: string;
  header: string;
  type?: ColType;
  required?: boolean;
  /** Pilihan untuk kolom enum: value disimpan, label yang ditulis user. Keduanya diterima saat impor. */
  options?: { value: string; label: string }[];
  width?: number;
  note?: string;
  /** Kolom informasi saja (diisi template, diabaikan saat impor kecuali sebagai kunci) */
  readOnly?: boolean;
}
export interface RefSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}
export type Row = Record<string, string>;
export interface ParseResult {
  rows: Row[];
  /** Nomor baris Excel per row (untuk pesan error) */
  lines: number[];
  errors: string[];
}

const TEAL = 'FF0A4152';
const COPPER_SOFT = 'FFF7EBE1';
const GREY = 'FF5B7078';

async function loadExcel() {
  const mod: any = await import('exceljs');
  return mod.default ?? mod;
}

function colLetter(n: number) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function typeLabel(c: ExcelCol) {
  switch (c.type) {
    case 'number': return 'Angka (boleh desimal)';
    case 'integer': return 'Angka bulat';
    case 'date': return 'Tanggal (YYYY-MM-DD atau format tanggal Excel)';
    case 'enum': return 'Pilih dari daftar';
    default: return 'Teks';
  }
}

/** Buat & unduh template Excel. `prefill` mengisi baris awal (mis. daftar item RFQ). */
export async function downloadTemplate(opts: { fileName: string; title: string; columns: ExcelCol[]; prefill?: Row[]; refSheets?: RefSheet[] }) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERP Umira';
  const ws = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = opts.columns.map((c) => ({ header: c.header + (c.required ? ' *' : ''), key: c.key, width: c.width ?? Math.max(14, c.header.length + 4) }));
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell: any, i: number) => {
    const c = opts.columns[i - 1];
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c?.readOnly ? GREY : TEAL } };
    cell.alignment = { vertical: 'middle' };
  });

  // Sheet daftar pilihan (untuk dropdown)
  const enums = opts.columns.filter((c) => c.type === 'enum' && c.options?.length);
  let listWs: any = null;
  if (enums.length) {
    listWs = wb.addWorksheet('Pilihan');
    enums.forEach((c, i) => {
      listWs.getCell(1, i + 1).value = c.header;
      listWs.getCell(1, i + 1).font = { bold: true };
      c.options!.forEach((o, r) => (listWs.getCell(r + 2, i + 1).value = o.label));
      listWs.getColumn(i + 1).width = Math.max(18, c.header.length + 4);
    });
  }

  const rowsCount = Math.max(200, (opts.prefill?.length ?? 0) + 50);
  (opts.prefill ?? []).forEach((r) => {
    const vals: any = {};
    opts.columns.forEach((c) => {
      const v = r[c.key];
      if (v === undefined || v === '') return;
      if (c.type === 'enum') vals[c.key] = c.options?.find((o) => o.value === v)?.label ?? v;
      else if ((c.type === 'number' || c.type === 'integer') && !isNaN(Number(v))) vals[c.key] = Number(v);
      else vals[c.key] = v;
    });
    const row = ws.addRow(vals);
    opts.columns.forEach((c, i) => {
      if (c.readOnly) row.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COPPER_SOFT } };
    });
  });

  // Validasi data & format kolom
  opts.columns.forEach((c, i) => {
    const L = colLetter(i + 1);
    for (let r = 2; r <= rowsCount + 1; r++) {
      const cell = ws.getCell(`${L}${r}`);
      if (c.type === 'enum' && c.options?.length) {
        const j = enums.indexOf(c) + 1;
        const LL = colLetter(j);
        cell.dataValidation = { type: 'list', allowBlank: !c.required, formulae: [`Pilihan!$${LL}$2:$${LL}$${c.options.length + 1}`], showErrorMessage: true, errorTitle: 'Pilihan tidak valid', error: `Pilih salah satu nilai ${c.header}` };
      } else if (c.type === 'number' || c.type === 'integer') {
        cell.numFmt = c.type === 'integer' ? '0' : '#,##0.##';
      } else if (c.type === 'date') {
        cell.numFmt = 'yyyy-mm-dd';
      }
    }
  });

  // Petunjuk
  const help = wb.addWorksheet('Petunjuk');
  help.getColumn(1).width = 28;
  help.getColumn(2).width = 12;
  help.getColumn(3).width = 42;
  help.getColumn(4).width = 60;
  help.getCell('A1').value = opts.title;
  help.getCell('A1').font = { bold: true, size: 14, color: { argb: TEAL } };
  help.getCell('A2').value = 'Isi sheet "Data" mulai baris 2. Kolom bertanda * wajib diisi. Jangan mengubah judul kolom. Baris kosong diabaikan.';
  help.getCell('A2').font = { color: { argb: GREY } };
  const hr = help.getRow(4);
  ['Kolom', 'Wajib', 'Format', 'Keterangan'].forEach((h, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  });
  opts.columns.forEach((c, i) => {
    const r = help.getRow(5 + i);
    r.getCell(1).value = c.header;
    r.getCell(2).value = c.readOnly ? 'Info' : c.required ? 'Ya' : 'Tidak';
    r.getCell(3).value = typeLabel(c);
    r.getCell(4).value = [c.note, c.type === 'enum' ? `Pilihan: ${c.options?.map((o) => o.label).join(', ')}` : '', c.readOnly ? 'Kolom abu-abu/tembaga hanya informasi, jangan diubah.' : ''].filter(Boolean).join(' ');
    r.getCell(4).alignment = { wrapText: true, vertical: 'top' };
  });

  for (const ref of opts.refSheets ?? []) {
    const rs = wb.addWorksheet(ref.name.slice(0, 30));
    rs.addRow(ref.headers).font = { bold: true };
    ref.rows.forEach((r) => rs.addRow(r));
    ref.headers.forEach((h, i) => (rs.getColumn(i + 1).width = Math.max(14, h.length + 4, ...ref.rows.slice(0, 200).map((r) => String(r[i] ?? '').length + 2))));
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.fileName.endsWith('.xlsx') ? opts.fileName : `${opts.fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const norm = (s: string) => s.toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9%]+/g, ' ').trim();

function cellText(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isoDate(v);
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result);
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return String(v.text);
    if ('error' in v) return '';
  }
  return String(v).trim();
}

function isoDate(d: Date) {
  // Tanggal Excel disimpan UTC tanpa zona; ambil komponen UTC
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Terima "1.234.567,89" (Indonesia), "1,234,567.89", "1234567.89", "Rp 1.000" */
export function parseNumber(raw: any): number | null {
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  let s = cellText(raw).replace(/rp/i, '').replace(/\s/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // "1,5" → desimal; "1,000,000" → ribuan
    s = (s.match(/,/g)!.length > 1 || /,\d{3}$/.test(s)) && !/^\d{1,3},\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0 && (s.match(/\./g)!.length > 1 || /^\d{1,3}\.\d{3}$/.test(s))) {
    s = s.replace(/\./g, '');
  }
  s = s.replace(/%$/, '');
  const n = Number(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

function parseDate(raw: any): string | null {
  if (raw instanceof Date) return isoDate(raw);
  if (typeof raw === 'number') {
    // serial Excel
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
    return isoDate(d);
  }
  const s = cellText(raw);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Baca file unggahan. Header dicocokkan dengan judul kolom atau key (tidak peka huruf besar/kecil). */
export async function parseExcelFile(file: File, columns: ExcelCol[]): Promise<ParseResult> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Gunakan file .xlsx (unduh template dari tombol "Unduh template").');
  const { default: readXlsx } = await import('read-excel-file/browser');
  let sheets: { sheet: string; data: any[][] }[];
  try {
    sheets = (await readXlsx(file)) as any;
  } catch (e) {
    console.error('Gagal membaca xlsx', e);
    throw new Error('File tidak bisa dibaca. Pastikan formatnya .xlsx (Excel 2007 ke atas).');
  }
  const ws = sheets.find((x) => x.sheet === 'Data') ?? sheets.find((x) => !['Petunjuk', 'Pilihan'].includes(x.sheet)) ?? sheets[0];
  if (!ws) throw new Error('Sheet tidak ditemukan.');
  const data = ws.data ?? [];

  // Cari baris header (dalam 5 baris pertama)
  let headerIdx = -1;
  const colIndex: Record<string, number> = {};
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const found: Record<string, number> = {};
    (data[r] ?? []).forEach((v, ci) => {
      const t = norm(cellText(v));
      const c = columns.find((c) => norm(c.header) === t || norm(c.key) === t);
      if (c && !(c.key in found)) found[c.key] = ci;
    });
    if (Object.keys(found).length >= Math.min(2, columns.length)) {
      headerIdx = r;
      Object.assign(colIndex, found);
      break;
    }
  }
  if (headerIdx < 0) throw new Error('Judul kolom tidak dikenali. Gunakan template dari tombol "Unduh template".');

  const missing = columns.filter((c) => c.required && !c.readOnly && !(c.key in colIndex));
  if (missing.length) throw new Error(`Kolom wajib tidak ada: ${missing.map((c) => c.header).join(', ')}`);

  const rows: Row[] = [];
  const lines: number[] = [];
  const errors: string[] = [];
  for (let r = headerIdx + 1; r < data.length; r++) {
    const line = r + 1;
    const raw: Record<string, any> = {};
    let any = false;
    for (const c of columns) {
      const ci = colIndex[c.key];
      if (ci === undefined) continue;
      const v = data[r]?.[ci];
      raw[c.key] = v;
      if (!c.readOnly && cellText(v) !== '') any = true;
    }
    if (!any) continue;
    const out: Row = {};
    const errs: string[] = [];
    for (const c of columns) {
      const v = raw[c.key];
      const text = cellText(v);
      if (text === '') {
        if (c.required && !c.readOnly) errs.push(`${c.header} wajib diisi`);
        out[c.key] = '';
        continue;
      }
      switch (c.type) {
        case 'number':
        case 'integer': {
          const n = parseNumber(v);
          if (n === null) errs.push(`${c.header} "${text}" bukan angka`);
          else out[c.key] = String(c.type === 'integer' ? Math.round(n) : Math.round(n * 10000) / 10000);
          break;
        }
        case 'date': {
          const d = parseDate(v);
          if (!d) errs.push(`${c.header} "${text}" bukan tanggal`);
          else out[c.key] = d;
          break;
        }
        case 'enum': {
          const t = norm(text);
          const o = c.options?.find((o) => norm(o.label) === t || norm(o.value) === t);
          if (!o) errs.push(`${c.header} "${text}" tidak ada di pilihan`);
          else out[c.key] = o.value;
          break;
        }
        default:
          out[c.key] = typeof v === 'number' && Number.isInteger(v) ? String(v) : text;
      }
    }
    if (errs.length) errors.push(`Baris ${line}: ${errs.join('; ')}`);
    else {
      rows.push(out);
      lines.push(line);
    }
  }
  return { rows, lines, errors };
}

/** Helper: daftar kategori biaya untuk kolom enum */
export const CATEGORY_OPTIONS = [
  { value: 'MATERIAL', label: 'Material' },
  { value: 'LABOR', label: 'Upah' },
  { value: 'EQUIPMENT', label: 'Alat' },
  { value: 'SUBCONTRACTOR', label: 'Subkon' },
  { value: 'OVERHEAD', label: 'Overhead' },
  { value: 'OTHER', label: 'Lain-lain' },
];
