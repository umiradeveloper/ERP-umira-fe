'use client';

import { ExportButton } from '@/components/export-button';
import { Badge, BudgetBar, Empty, ErrorBox, Loading, PageHeader, Panel, Table, Td, Th, Tr } from '@/components/ui';
import { useApi } from '@/lib/api';
import { pct, rupiahShort, toNum } from '@/lib/format';

export default function CostPage() {
  const { data, error, loading, reload } = useApi<any[]>('/reports/cost-control');
  const rows = (data ?? []).filter((p) => toNum(p.cost.budget) > 0 || toNum(p.cost.actual) > 0);
  const sum = (k: string) => rows.reduce((a, p) => a + toNum(p.cost[k]), 0);

  return (
    <div className="animate-rise">
      <PageHeader title="Cost control" description="Budget, commitment, actual dan forecast seluruh proyek. Peringatan muncul di 80% dan 100% budget." actions={<ExportButton path="/exports/cost-control.xlsx" />} />
      <ErrorBox error={error} onRetry={reload} />

      <Panel className="mb-6">
        <div className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Def term="Budget" text="Baseline biaya yang disetujui (dari estimasi tender atau disusun manual)." />
          <Def term="Commitment" text="PO yang sudah disetujui tetapi belum ditagih supplier." />
          <Def term="Actual" text="Biaya diakui dari invoice supplier yang sudah diposting." />
          <Def term="EAC" text="Estimate at completion: actual + commitment + sisa budget." />
        </div>
      </Panel>

      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty title="Belum ada proyek dengan budget" /> : (
          <Table>
            <thead>
              <tr><Th>Proyek</Th><Th right>Budget</Th><Th right>Commitment</Th><Th right>Actual</Th><Th right>EAC</Th><Th right>Varian</Th><Th className="w-48">Pemakaian</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Tr key={p.id} href={`/projects/${p.id}`}>
                  <Td><div className="font-medium">{p.name}</div><div className="text-xs text-muted">{p.code}</div></Td>
                  <Td right>{rupiahShort(p.cost.budget)}</Td>
                  <Td right>{rupiahShort(p.cost.commitment)}</Td>
                  <Td right>{rupiahShort(p.cost.actual)}</Td>
                  <Td right className="font-medium">{rupiahShort(p.cost.eac)}</Td>
                  <Td right className={toNum(p.cost.variance) < 0 ? 'text-bad' : ''}>{rupiahShort(p.cost.variance)}</Td>
                  <Td><BudgetBar budget={p.cost.budget} actual={p.cost.actual} commitment={p.cost.commitment} /><div className="num mt-1 text-xs text-muted">{pct(p.cost.usedPct, 0)}</div></Td>
                  <Td><Badge status={p.cost.alert} /></Td>
                </Tr>
              ))}
              <tr className="bg-hover font-semibold">
                <Td>Portofolio</Td>
                <Td right>{rupiahShort(sum('budget'))}</Td>
                <Td right>{rupiahShort(sum('commitment'))}</Td>
                <Td right>{rupiahShort(sum('actual'))}</Td>
                <Td right>{rupiahShort(sum('eac'))}</Td>
                <Td right>{rupiahShort(sum('variance'))}</Td>
                <Td colSpan={2}><BudgetBar budget={sum('budget')} actual={sum('actual')} commitment={sum('commitment')} /></Td>
              </tr>
            </tbody>
          </Table>
        )}
      </Panel>
      <div className="mt-3 flex gap-5 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-ink" /> Actual</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-ink/30" /> Commitment</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-line" /> Sisa budget</span>
      </div>
    </div>
  );
}

function Def({ term, text }: { term: string; text: string }) {
  return (
    <div>
      <div className="font-semibold">{term}</div>
      <p className="mt-0.5 text-muted">{text}</p>
    </div>
  );
}
