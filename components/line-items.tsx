'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select } from './ui';
import { CATEGORY_LABEL, rupiah, toNum } from '@/lib/format';
import { CATEGORY_OPTIONS } from '@/lib/excel';
import { ExcelImport } from './excel-import';

export type LineItem = { description: string; quantity: string; unit: string; price: string; category: string };
const CATS = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OVERHEAD', 'OTHER'];
export const emptyLine = (): LineItem => ({ description: '', quantity: '1', unit: '', price: '0', category: 'MATERIAL' });

/** Editor baris item untuk PR / PO */
export function LineItemsEditor({ items, onChange, priceLabel }: { items: LineItem[]; onChange: (v: LineItem[]) => void; priceLabel: string }) {
  const upd = (i: number, k: keyof LineItem, v: string) => onChange(items.map((r, x) => (x === i ? { ...r, [k]: v } : r)));
  const total = items.reduce((a, r) => a + toNum(r.quantity) * toNum(r.price), 0);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-[13px]">
          <thead className="bg-hover text-xs text-muted">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="pl-3">Uraian</th><th className="w-20">Volume</th><th className="w-16">Sat.</th><th className="w-32">{priceLabel}</th><th className="w-32">Kategori</th><th className="w-28 text-right">Jumlah</th><th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i} className="border-t border-line [&>td]:px-1.5 [&>td]:py-1.5">
                <td className="pl-2"><Input className="h-8 text-[13px]" value={r.description} onChange={(e) => upd(i, 'description', e.target.value)} placeholder="Nama barang / jasa" /></td>
                <td><Input type="number" className="h-8 text-[13px]" value={r.quantity} onChange={(e) => upd(i, 'quantity', e.target.value)} /></td>
                <td><Input className="h-8 text-[13px]" value={r.unit} onChange={(e) => upd(i, 'unit', e.target.value)} /></td>
                <td><Input type="number" className="h-8 text-[13px]" value={r.price} onChange={(e) => upd(i, 'price', e.target.value)} /></td>
                <td><Select className="h-8 text-[13px]" value={r.category} onChange={(e) => upd(i, 'category', e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select></td>
                <td className="num pr-2 text-right">{rupiah(toNum(r.quantity) * toNum(r.price))}</td>
                <td>
                  <button type="button" disabled={items.length === 1} onClick={() => onChange(items.filter((_, x) => x !== i))} className="rounded p-1 text-faint hover:bg-bad-soft hover:text-bad disabled:opacity-30" aria-label="Hapus baris">
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => onChange([...items, emptyLine()])}>Tambah item</Button>
          <ExcelImport
            title="Impor item dari Excel"
            templateName="template-item"
            modes
            columns={[
              { key: 'description', header: 'Uraian', required: true, width: 40 },
              { key: 'quantity', header: 'Volume', type: 'number', required: true },
              { key: 'unit', header: 'Satuan', width: 10 },
              { key: 'price', header: priceLabel, type: 'number', width: 18 },
              { key: 'category', header: 'Kategori', type: 'enum', options: CATEGORY_OPTIONS },
            ]}
            onApply={(rows, mode) => {
              const add = rows.map((r) => ({ description: r.description, quantity: r.quantity || '1', unit: r.unit, price: r.price || '0', category: r.category || 'MATERIAL' }));
              onChange(mode === 'replace' ? add : [...items.filter((x) => x.description.trim()), ...add]);
            }}
          />
        </div>
        <div className="text-sm">Total <span className="num ml-2 font-semibold">{rupiah(total)}</span></div>
      </div>
    </div>
  );
}
