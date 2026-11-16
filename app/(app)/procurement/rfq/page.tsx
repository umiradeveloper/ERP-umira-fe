'use client';

import { Badge, Empty, ErrorBox, Loading, PageHeader, Panel, Table, Td, Th, Tr } from '@/components/ui';
import { useApi } from '@/lib/api';
import { date } from '@/lib/format';

const STATUS: Record<string, [string, 'info' | 'ok' | 'neutral']> = {
  OPEN: ['Menunggu penawaran', 'info'],
  AWARDED: ['Sudah dipilih', 'ok'],
  CANCELLED: ['Batal', 'neutral'],
};

export default function RfqListPage() {
  const { data, error, loading, reload } = useApi<any[]>('/rfqs');
  return (
    <div className="animate-rise">
      <PageHeader
        title="RFQ & penawaran"
        description="Minta penawaran ke beberapa supplier untuk PR yang sudah disetujui, bandingkan harga, lead time dan termin, lalu pilih pemenang untuk dijadikan PO."
      />
      <ErrorBox error={error} onRetry={reload} />
      <Panel bodyClass="p-0">
        {loading && !data ? <Loading /> : !data?.length ? (
          <Empty title="Belum ada RFQ">Buka PR yang sudah disetujui, lalu pilih “Minta penawaran”.</Empty>
        ) : (
          <Table>
            <thead><tr><Th>Nomor</Th><Th>Judul</Th><Th>Proyek</Th><Th>Batas penawaran</Th><Th right>Penawaran masuk</Th><Th>Pemenang</Th><Th>Status</Th></tr></thead>
            <tbody>
              {data.map((r) => (
                <Tr key={r.id} href={`/procurement/rfq/${r.id}`}>
                  <Td className="font-medium">{r.number}</Td>
                  <Td className="max-w-xs truncate">{r.title}</Td>
                  <Td className="text-ink-2">{r.project?.code}</Td>
                  <Td className="text-muted">{date(r.dueDate)}</Td>
                  <Td right>{r._count.quotations} dari {r._count.suppliers}</Td>
                  <Td className="text-ink-2">{r.awardedSupplierName ?? '—'}</Td>
                  <Td><Badge label={STATUS[r.status]?.[0] ?? r.status} tone={STATUS[r.status]?.[1] ?? 'neutral'} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
