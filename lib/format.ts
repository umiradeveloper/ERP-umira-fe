type Num = string | number | null | undefined;

export const toNum = (v: Num) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Rp 1.250.000 */
export function rupiah(v: Num) {
  return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(toNum(v));
}

/** Rp 1,25 M — ringkas untuk kartu & tabel padat */
export function rupiahShort(v: Num) {
  const n = toNum(v);
  const a = Math.abs(n);
  const f = (x: number, s: string) =>
    `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: x >= 100 ? 0 : x >= 10 ? 1 : 2 }).format(x)} ${s}`;
  const sign = n < 0 ? '−' : '';
  if (a >= 1e12) return sign + f(a / 1e12, 'T');
  if (a >= 1e9) return sign + f(a / 1e9, 'M');
  if (a >= 1e6) return sign + f(a / 1e6, 'jt');
  if (a >= 1e3) return sign + f(a / 1e3, 'rb');
  return sign + 'Rp ' + a.toFixed(0);
}

export function num(v: Num, digits = 2) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(toNum(v));
}

export function pct(v: Num, digits = 1) {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(toNum(v))}%`;
}

export function date(v?: string | Date | null) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v));
}

export function dateTime(v?: string | Date | null) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(y, m - 1, 1));
}

export const today = () => new Date().toISOString().slice(0, 10);

export const CATEGORY_LABEL: Record<string, string> = {
  MATERIAL: 'Material',
  LABOR: 'Upah',
  EQUIPMENT: 'Alat',
  SUBCONTRACTOR: 'Subkon',
  OVERHEAD: 'Overhead',
  TAX: 'Pajak',
  OTHER: 'Lain-lain',
};
