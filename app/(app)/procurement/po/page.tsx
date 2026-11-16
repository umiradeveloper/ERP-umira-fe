'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PoForm } from '@/components/po-form';
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Panel, Table, Tabs, Td, Th, Tr } from '@/components/ui';
import { can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, rupiahShort } from '@/lib/format';

const GROUPS: Record<string, string[]> = {
  draft: ['DRAFT', 'IN_APPROVAL', 'APPROVED'],
  open: ['ISSUED', 'PARTIAL_RECEIPT'],
  done: ['RECEIVED', 'CLOSED', 'CANCELLED'],
};

export default function PoListPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>('/purchase-orders');
  const [tab, setTab] = useState('open');
  const [open, setOpen] = useState(false);
  const rows = (data ?? []).filter((r) => GROUPS[tab].includes(r.status));
  const count = (g: string) => (data ?? []).filter((r) => GROUPS[g].includes(r.status)).length;

  return (
    <div className="animate-rise">
      <PageHeader
        title="Purchase order"
        description="PO yang disetujui menjadi commitment biaya proyek sampai ditagih supplier."
        actions={can(user, 'procurement:write') && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>PO manual</Button>}
      />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'draft', label: 'Draft & approval', count: count('draft') },
        { value: 'open', label: 'Menunggu barang', count: count('open') },
        { value: 'done', label: 'Selesai', count: count('done') },
      ]} />
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty title="Tidak ada PO di sini" /> : (
          <Table>
            <thead><tr><Th>Nomor</Th><Th>Supplier</Th><Th>Proyek</Th><Th>Dari PR</Th><Th>Tanggal</Th><Th right>Total</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id} href={`/procurement/po/${r.id}`}>
                  <Td className="font-medium">{r.number}</Td>
                  <Td>{r.supplier.name}</Td>
                  <Td className="text-ink-2">{r.project.code}</Td>
                  <Td className="text-muted">{r.request?.number ?? '—'}</Td>
                  <Td className="text-muted">{date(r.orderDate)}</Td>
                  <Td right className="font-medium">{rupiahShort(r.total)}</Td>
                  <Td><Badge status={r.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {open && <PoForm open={open} onClose={() => setOpen(false)} />}
    </div>
  );
}
