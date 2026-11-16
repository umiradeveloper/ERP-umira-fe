'use client';

import { bulkCreate, ExcelImport } from '@/components/excel-import';
import { useState } from 'react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/export-button';
import { Badge, Button, ErrorBox, Field, Input, Loading, PageHeader, Panel, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime, rupiah, toNum } from '@/lib/format';

const TYPE: Record<string, string> = { ASSET: 'Aset', LIABILITY: 'Kewajiban', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban' };

export default function ReportsPage() {
  const [tab, setTab] = useState<'tb' | 'is' | 'coa' | 'period'>('tb');
  return (
    <div className="animate-rise">
      <PageHeader title="Laporan keuangan" description="Dihitung dari jurnal yang sudah diposting." />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'tb', label: 'Neraca saldo' },
        { value: 'is', label: 'Laba rugi' },
        { value: 'coa', label: 'Bagan akun' },
        { value: 'period', label: 'Tutup periode' },
      ]} />
      {tab === 'tb' && <TrialBalance />}
      {tab === 'is' && <IncomeStatement />}
      {tab === 'coa' && <Coa />}
      {tab === 'period' && <Periods />}
    </div>
  );
}

function TrialBalance() {
  const { data, error, loading, reload } = useApi<any>('/reports/trial-balance');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <Panel bodyClass="p-0" title="Neraca saldo" actions={<div className="flex items-center gap-3"><Badge label={data.balanced ? 'Debit = kredit' : 'Tidak balance'} tone={data.balanced ? 'ok' : 'bad'} /><ExportButton size="sm" path="/exports/trial-balance.xlsx" /></div>}>
      <Table>
        <thead><tr><Th>Kode</Th><Th>Akun</Th><Th>Tipe</Th><Th right>Mutasi debit</Th><Th right>Mutasi kredit</Th><Th right>Saldo debit</Th><Th right>Saldo kredit</Th></tr></thead>
        <tbody>
          {data.rows.map((r: any) => (
            <Tr key={r.id}>
              <Td className="num text-muted">{r.code}</Td><Td className="font-medium">{r.name}</Td><Td className="text-muted">{TYPE[r.accountType]}</Td>
              <Td right className="text-muted">{rupiah(r.debit)}</Td><Td right className="text-muted">{rupiah(r.credit)}</Td>
              <Td right>{toNum(r.balanceDebit) ? rupiah(r.balanceDebit) : ''}</Td><Td right>{toNum(r.balanceCredit) ? rupiah(r.balanceCredit) : ''}</Td>
            </Tr>
          ))}
          <tr className="bg-hover font-semibold"><Td colSpan={5}>Total</Td><Td right>{rupiah(data.totalDebit)}</Td><Td right>{rupiah(data.totalCredit)}</Td></tr>
        </tbody>
      </Table>
    </Panel>
  );
}

function IncomeStatement() {
  const { data, loading } = useApi<any>('/reports/income-statement');
  if (loading || !data) return <Loading />;
  const Section = ({ title, rows, total }: { title: string; rows: any[]; total: any }) => (
    <>
      <tr><Td colSpan={2} className="bg-canvas/60 font-semibold">{title}</Td></tr>
      {rows.map((r) => <Tr key={r.code}><Td><span className="num mr-2 text-muted">{r.code}</span>{r.name}</Td><Td right>{rupiah(r.amount)}</Td></Tr>)}
      <tr className="font-semibold"><Td>Total {title.toLowerCase()}</Td><Td right>{rupiah(total)}</Td></tr>
    </>
  );
  const net = toNum(data.netIncome);
  return (
    <Panel bodyClass="p-0" title="Laba rugi" subtitle="Sejak awal pembukuan" className="max-w-3xl">
      <Table>
        <tbody>
          <Section title="Pendapatan" rows={data.revenue} total={data.totalRevenue} />
          <Section title="Beban" rows={data.expense} total={data.totalExpense} />
          <tr className="bg-ink text-white"><Td className="font-semibold">Laba (rugi) bersih</Td><Td right className={`text-lg font-semibold ${net < 0 ? 'text-red-300' : 'text-signal'}`}>{rupiah(net)}</Td></tr>
        </tbody>
      </Table>
    </Panel>
  );
}

function Coa() {
  const { user } = useAuth();
  const { data, reload } = useApi<any[]>('/accounts');
  const [f, setF] = useState({ code: '', name: '', accountType: 'EXPENSE' });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api('/accounts', { body: f });
      toast.success('Akun ditambahkan');
      setF({ code: '', name: '', accountType: 'EXPENSE' });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel bodyClass="p-0" title="Bagan akun (COA)">
        <Table>
          <thead><tr><Th>Kode</Th><Th>Nama akun</Th><Th>Tipe</Th></tr></thead>
          <tbody>{data?.map((a) => <Tr key={a.id}><Td className="num">{a.code}</Td><Td className="font-medium">{a.name}</Td><Td className="text-muted">{TYPE[a.accountType]}</Td></Tr>)}</tbody>
        </Table>
      </Panel>
      {can(user, 'accounting:write') && (
        <Panel title="Tambah akun" actions={
          <ExcelImport
            title="Impor bagan akun dari Excel"
            templateName="template-coa"
            hint="Kode akun yang sudah ada akan ditolak (dilewati)."
            columns={[
              { key: 'code', header: 'Kode', required: true, note: '4–8 digit' },
              { key: 'name', header: 'Nama akun', required: true, width: 36 },
              { key: 'accountType', header: 'Tipe', type: 'enum', required: true, options: Object.entries(TYPE).map(([value, label]) => ({ value, label: String(label) })) },
            ]}
            onApply={async (rows, _m, lines) => {
              const res = await bulkCreate(rows, lines, (r) => api('/accounts', { body: { code: r.code.trim(), name: r.name, accountType: r.accountType } }));
              reload();
              return res;
            }}
          />
        }>
          <div className="space-y-4">
            <Field label="Kode (4–8 digit)"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Tipe">
              <select className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm" value={f.accountType} onChange={(e) => setF({ ...f, accountType: e.target.value })}>
                {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Button onClick={save} loading={saving} disabled={!f.code || !f.name} className="w-full">Tambah akun</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Periods() {
  const { user } = useAuth();
  const { data, reload } = useApi<any[]>('/accounting-periods');
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [period, setPeriod] = useState(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  const [saving, setSaving] = useState(false);
  async function close() {
    setSaving(true);
    try {
      await api(`/accounting-periods/${period}/close`, { body: {} });
      toast.success(`Periode ${period} ditutup. Transaksi baru di periode ini akan ditolak.`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      {can(user, 'accounting:write') && (
        <Panel title="Tutup periode">
          <p className="mb-4 text-sm text-muted">Setelah ditutup, tidak ada jurnal yang bisa diposting ke periode tersebut. Pastikan semua draft sudah diposting.</p>
          <Field label="Periode (YYYY-MM)"><Input value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
          <Button className="mt-4 w-full" variant="danger" onClick={close} loading={saving}>Tutup periode {period}</Button>
        </Panel>
      )}
      <Panel title="Periode tercatat" bodyClass="p-0">
        {!data?.length ? <p className="px-5 py-6 text-sm text-muted">Semua periode masih terbuka.</p> : (
          <Table>
            <tbody>{data.map((p) => <Tr key={p.id}><Td className="num font-medium">{p.period}</Td><Td><Badge status={p.status} label={p.status === 'CLOSED' ? 'Ditutup' : undefined} /></Td><Td className="text-muted">{dateTime(p.closedAt)}</Td></Tr>)}</tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
