'use client';

import { useState } from 'react';
import { Input, Loading, PageHeader, Panel, Select, Table, Td, Th, Tr } from '@/components/ui';
import { useApi } from '@/lib/api';
import { dateTime } from '@/lib/format';

const TYPES = ['', 'Project', 'Tender', 'PurchaseRequest', 'PurchaseOrder', 'GoodsReceipt', 'SupplierInvoice', 'CustomerInvoice', 'JournalEntry', 'Asset', 'User', 'PR', 'PO'];

export default function AuditPage() {
  const [entityType, setType] = useState('');
  const [search, setSearch] = useState('');
  const qs = new URLSearchParams({ ...(entityType ? { entityType } : {}), ...(search ? { search } : {}) }).toString();
  const { data, loading } = useApi<any[]>(`/audit-logs${qs ? `?${qs}` : ''}`);
  return (
    <div className="animate-rise">
      <PageHeader title="Audit log" description="Catatan append-only: siapa melakukan apa, kapan, pada dokumen mana." />
      <Panel bodyClass="p-0" title={
        <div className="flex gap-2">
          <Select className="h-9 w-52" value={entityType} onChange={(e) => setType(e.target.value)} aria-label="Jenis dokumen">
            {TYPES.map((t) => <option key={t} value={t}>{t || 'Semua dokumen'}</option>)}
          </Select>
          <Input className="h-9 w-64" placeholder="Cari aksi atau nama user" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      }>
        {loading && !data ? <Loading /> : (
          <Table>
            <thead><tr><Th>Waktu</Th><Th>User</Th><Th>Aksi</Th><Th>Dokumen</Th><Th>Detail</Th></tr></thead>
            <tbody>
              {data?.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap text-muted">{dateTime(a.createdAt)}</Td>
                  <Td className="font-medium">{a.actorName}</Td>
                  <Td><span className="rounded bg-canvas px-1.5 py-0.5 text-xs">{a.action}</span></Td>
                  <Td className="text-ink-2">{a.entityType}</Td>
                  <Td className="max-w-md truncate text-xs text-muted">{a.metadata ? JSON.stringify(a.metadata) : ''}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
