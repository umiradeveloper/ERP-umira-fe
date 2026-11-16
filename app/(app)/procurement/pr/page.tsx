'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PrForm } from '@/components/pr-form';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, rupiahShort } from '@/lib/format';

const GROUPS: Record<string, string[]> = {
  active: ['DRAFT', 'IN_APPROVAL', 'REVISION'],
  approved: ['APPROVED'],
  done: ['CONVERTED', 'REJECTED', 'CANCELLED'],
};

export default function PrListPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>('/purchase-requests');
  const [tab, setTab] = useState('active');
  const [open, setOpen] = useState(false);
  const rows = (data ?? []).filter((r) => GROUPS[tab].includes(r.status));
  const canWrite = can(user, 'procurement:write') || can(user, 'project:write');

  return (
    <div className="animate-rise">
      <PageHeader
        title="Purchase request"
        description="Permintaan kebutuhan dari proyek. PR yang disetujui dapat diproses menjadi PO."
        actions={canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Buat PR</Button>}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'active', label: 'Berjalan', count: (data ?? []).filter((r) => GROUPS.active.includes(r.status)).length },
          { value: 'approved', label: 'Siap dibuat PO', count: (data ?? []).filter((r) => r.status === 'APPROVED').length },
          { value: 'done', label: 'Selesai', count: (data ?? []).filter((r) => GROUPS.done.includes(r.status)).length },
        ]}
      />
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty title="Tidak ada PR di sini" /> : (
          <Table>
            <thead><tr><Th>Nomor</Th><Th>Proyek</Th><Th>Pemohon</Th><Th>Dibutuhkan</Th><Th right>Item</Th><Th right>Estimasi</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id} href={`/procurement/pr/${r.id}`}>
                  <Td className="font-medium">{r.number}</Td>
                  <Td><div>{r.project.name}</div><div className="text-xs text-muted">{r.project.code}</div></Td>
                  <Td className="text-ink-2">{r.requestedByName}</Td>
                  <Td className="text-muted">{date(r.neededAt)}</Td>
                  <Td right>{r._count.items}</Td>
                  <Td right className="font-medium">{rupiahShort(r.totalEstimate)}</Td>
                  <Td><Badge status={r.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <PrForm open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
