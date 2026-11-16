'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { ApprovalTimeline } from '@/components/approval-timeline';
import { PoForm } from '@/components/po-form';
import { PrForm } from '@/components/pr-form';
import { RfqFromPrModal } from '@/components/rfq-from-pr';
import { Attachments } from '@/components/attachments';
import { Badge, Button, ErrorBox, KV, Loading, PageHeader, Panel, Table, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CATEGORY_LABEL, date, num, rupiah, rupiahShort, toNum } from '@/lib/format';

export default function PrDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: pr, error, loading, reload } = useApi<any>(`/purchase-requests/${id}`);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [po, setPo] = useState(false);
  const [rfq, setRfq] = useState(false);
  const [k, setK] = useState(0);

  if (loading && !pr) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!pr) return null;
  const canWrite = can(user, 'procurement:write') || can(user, 'project:write');
  const editable = ['DRAFT', 'REVISION'].includes(pr.status) && canWrite;
  const overBudget = pr.budgetCheck.some((b: any) => b.overBudget);

  async function submit() {
    setBusy(true);
    try {
      const r = await api(`/purchase-requests/${id}/submit`, { body: {} });
      toast.success(r.status === 'APPROVED' ? 'PR disetujui otomatis' : 'PR diajukan untuk approval');
      reload();
      setK(k + 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        back={{ href: '/procurement/pr', label: 'Purchase request' }}
        title={pr.number}
        description={<span className="flex items-center gap-2"><Badge status={pr.status} /> {pr.project.name}</span>}
        actions={
          <>
            {editable && <Button variant="secondary" onClick={() => setEdit(true)}>Ubah</Button>}
            {editable && <Button onClick={submit} loading={busy}>Ajukan approval</Button>}
            {pr.status === 'APPROVED' && can(user, 'procurement:write') && <Button variant="secondary" onClick={() => setRfq(true)}>Minta penawaran (RFQ)</Button>}
            {pr.status === 'APPROVED' && can(user, 'procurement:write') && <Button onClick={() => setPo(true)}>Buat PO langsung</Button>}
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel>
            <KV cols={4} items={[['Proyek', pr.project.code], ['Pemohon', pr.requestedByName], ['Dibutuhkan', date(pr.neededAt)], ['Estimasi total', rupiah(pr.totalEstimate)]]} />
            {pr.notes && <p className="mt-4 border-t border-line pt-4 text-sm text-ink-2">{pr.notes}</p>}
          </Panel>

          <Panel title="Item" bodyClass="p-0">
            <Table>
              <thead><tr><Th>Uraian</Th><Th>Kategori</Th><Th right>Volume</Th><Th>Sat.</Th><Th right>Estimasi harga</Th><Th right>Jumlah</Th></tr></thead>
              <tbody>
                {pr.items.map((i: any) => (
                  <Tr key={i.id}>
                    <Td className="font-medium">{i.description}</Td>
                    <Td className="text-muted">{CATEGORY_LABEL[i.category]}</Td>
                    <Td right>{num(i.quantity)}</Td>
                    <Td className="text-muted">{i.unit}</Td>
                    <Td right>{rupiah(i.estimatedPrice)}</Td>
                    <Td right>{rupiah(toNum(i.quantity) * toNum(i.estimatedPrice))}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          <Panel title="Cek budget proyek" subtitle="Sisa = budget − actual − commitment, per kategori biaya">
            {overBudget && <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2.5 text-sm text-bad">Estimasi PR melebihi sisa budget. Approver akan melihat peringatan ini.</p>}
            <div className="space-y-3">
              {pr.budgetCheck.map((b: any) => (
                <div key={b.category} className="flex items-center justify-between gap-4 text-sm">
                  <span className="w-28 font-medium">{CATEGORY_LABEL[b.category]}</span>
                  <span className="flex-1 text-muted">Diminta <span className="num text-ink">{rupiahShort(b.requested)}</span> dari sisa <span className="num text-ink">{rupiahShort(b.available)}</span></span>
                  <Badge label={b.overBudget ? 'Melebihi sisa' : 'Tersedia'} tone={b.overBudget ? 'bad' : 'ok'} />
                </div>
              ))}
            </div>
          </Panel>

          {pr.purchaseOrders.length > 0 && (
            <Panel title="PO terkait" bodyClass="p-0">
              <Table>
                <tbody>
                  {pr.purchaseOrders.map((p: any) => (
                    <Tr key={p.id} href={`/procurement/po/${p.id}`}><Td className="font-medium">{p.number}</Td><Td><Badge status={p.status} /></Td><Td right>{rupiah(p.total)}</Td></Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          <ApprovalTimeline entityType="PR" entityId={id} refreshKey={`${k}-${pr.status}`} />
          <Attachments entityType="PurchaseRequest" entityId={id} canUpload={canWrite} />
          {pr.status === 'IN_APPROVAL' && (
            <p className="text-sm text-muted">Keputusan diambil dari halaman <Link href="/approvals" className="font-medium text-ink underline underline-offset-2">Approval saya</Link> oleh role yang berwenang.</p>
          )}
        </div>
      </div>

      {edit && <PrForm open={edit} onClose={() => setEdit(false)} initial={pr} prId={id} onSaved={reload} />}
      {po && <PoForm open={po} onClose={() => setPo(false)} pr={pr} />}
      {rfq && <RfqFromPrModal pr={pr} onClose={() => setRfq(false)} />}
    </div>
  );
}
