'use client';

import { bulkCreate, clean, ExcelImport } from '@/components/excel-import';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Field, Input, Loading, Modal, PageHeader, Panel, Table, Td, Th, Tr } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';

export default function UsersPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useApi<any[]>('/users');
  const { data: roles } = useApi<any[]>('/roles');
  const [edit, setEdit] = useState<any>(null);
  const w = can(user, 'admin:write');
  const { data: sa, reload: reloadSa } = useApi<any>('/superapps/status');
  const [syncing, setSyncing] = useState(false);
  async function syncSa() {
    setSyncing(true);
    try {
      const r = await api('/superapps/sync-users', { body: {} });
      toast.success(`Sinkron SuperApps: ${r.created} baru, ${r.updated} diperbarui, ${r.deactivated} dinonaktifkan`);
      reload();
      reloadSa();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader title="User" description="Akses berbasis role, deny-by-default. Menonaktifkan user langsung mencabut sesinya."
        actions={w && (
          <>
            {sa?.enabled && <Button variant="secondary" icon={<RefreshCw className="size-4" />} loading={syncing} onClick={syncSa}>Sinkron user SuperApps</Button>}
            <ExcelImport
              size="md"
              title="Impor user dari Excel"
              templateName="template-user"
              hint='Role ditulis sesuai sheet "Role", pisahkan dengan koma jika lebih dari satu. Password minimal 8 karakter.'
              columns={[
                { key: 'name', header: 'Nama', required: true, width: 26 },
                { key: 'email', header: 'Email', required: true, width: 30 },
                { key: 'title', header: 'Jabatan', width: 20 },
                { key: 'roles', header: 'Role', required: true, width: 30 },
                { key: 'password', header: 'Password awal', required: true, width: 18 },
              ]}
              refSheets={[{ name: 'Role', headers: ['Nama role', 'Keterangan'], rows: (roles ?? []).map((r) => [r.name, r.description ?? '']) }]}
              resolve={(r) => {
                const names = r.roles.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
                const ids: string[] = [];
                for (const n of names) {
                  const role = roles?.find((x) => x.name.toLowerCase() === n.toLowerCase());
                  if (!role) return `role "${n}" tidak ditemukan`;
                  ids.push(role.id);
                }
                if (r.password.length < 8) return 'password minimal 8 karakter';
                return { ...r, roleIds: ids.join(',') };
              }}
              onApply={async (rows, _m, lines) => {
                const res = await bulkCreate(rows, lines, (r) => api('/users', { body: clean({ name: r.name, email: r.email.trim().toLowerCase(), title: r.title, password: r.password, roleIds: r.roleIds.split(',') }) }));
                reload();
                return res;
              }}
            />
            <Button icon={<Plus className="size-4" />} onClick={() => setEdit({})}>Undang user</Button>
          </>
        )} />
      {sa?.enabled && (
        <div className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="font-medium">Akun dari SuperApps <span className="num text-ink-2">({sa.host})</span></span>
            <span className="text-muted">User login dengan email/username & password SuperApps. Role mengikuti pemetaan role SuperApps → ERP (Role & menu → Pemetaan role SuperApps).</span>
          </div>
          {sa.lastSync && (
            <div className="mt-1.5 text-xs text-muted">
              Sinkron terakhir {new Date(sa.lastSync.at).toLocaleString('id-ID')}: {sa.lastSync.total} akun SuperApps — {sa.lastSync.created} baru, {sa.lastSync.updated} diperbarui, {sa.lastSync.deactivated} dinonaktifkan, {sa.lastSync.skipped} tanpa akses
              {Object.keys(sa.lastSync.byReason ?? {}).length > 0 && <> ({Object.entries(sa.lastSync.byReason).map(([k, v]) => `${k}: ${v}`).join(', ')})</>}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel bodyClass="p-0" title="User">
          {loading && !data ? <Loading /> : (
            <Table>
              <thead><tr><Th>Nama</Th><Th>Role</Th><Th>Login terakhir</Th><Th>Status</Th></tr></thead>
              <tbody>
                {data?.map((u) => (
                  <Tr key={u.id} onClick={w ? () => setEdit(u) : undefined}>
                    <Td><div className="flex items-center gap-2 font-medium">{u.name}{u.externalSource === 'superapps' && <Badge label="SuperApps" tone="info" />}</div><div className="text-xs text-muted">{u.email.endsWith('@superapps.local') ? 'tanpa email' : u.email}{u.title ? ` · ${u.title}` : ''}</div></Td>
                    <Td><div className="flex flex-wrap gap-1">{u.roles.map((r: any) => <Badge key={r.id} label={r.name} />)}</div></Td>
                    <Td className="text-muted">{dateTime(u.lastLoginAt)}</Td>
                    <Td><Badge label={u.isActive ? 'Aktif' : 'Nonaktif'} tone={u.isActive ? 'ok' : 'neutral'} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <Panel title="Role" bodyClass="p-0" actions={<Link href="/admin/roles" className="text-[13px] font-medium text-ink-2 hover:underline">Atur role & menu</Link>}>
          <ul className="divide-y divide-line">
            {roles?.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{r.name}</div>
                  {r.description && <div className="truncate text-xs text-muted">{r.description}</div>}
                </div>
                <span className="num text-xs text-muted">{r.users} user</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {edit && <UserModal row={edit} roles={roles ?? []} onClose={() => setEdit(null)} onDone={reload} />}
    </div>
  );
}

function UserModal({ row, roles, onClose, onDone }: { row: any; roles: any[]; onClose: () => void; onDone: () => void }) {
  const isNew = !row.id;
  const external = row.externalSource === 'superapps';
  const [f, setF] = useState({ name: row.name ?? '', email: row.email ?? '', title: row.title ?? '', password: '' });
  const [roleIds, setRoleIds] = useState<string[]>(row.roles?.map((r: any) => r.id) ?? []);
  const [saving, setSaving] = useState(false);
  async function save(extra?: any) {
    setSaving(true);
    try {
      if (isNew) await api('/users', { body: { ...f, title: f.title || undefined, roleIds } });
      else await api(`/users/${row.id}`, { method: 'PATCH', body: extra ?? { roleIds } });
      toast.success('Tersimpan');
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={isNew ? 'Undang user' : row.name}
      footer={<>
        {!isNew && <Button variant="danger" className="mr-auto" onClick={() => save({ isActive: !row.isActive })}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</Button>}
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        {!external && <Button onClick={() => save()} loading={saving} disabled={!roleIds.length || (isNew && (!f.email || !f.name || f.password.length < 8))}>Simpan</Button>}
      </>}>
      {isNew && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nama"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Jabatan"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password awal" hint="Minimal 8 karakter"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </div>
      )}
      {external && (
        <p className="mb-4 rounded-lg bg-signal-soft px-3 py-2.5 text-sm text-signal-ink">
          Akun ini dari SuperApps{row.title ? ` (role: ${row.title})` : ''}. Password dikelola di SuperApps dan role ERP-nya mengikuti pemetaan di Role & menu → Pemetaan role SuperApps. Di sini hanya bisa diaktifkan/nonaktifkan.
        </p>
      )}
      <div className="text-[13px] font-medium text-ink-2">Role</div>
      <fieldset disabled={external} className="mt-2 grid gap-2 disabled:opacity-60 sm:grid-cols-2">
        {roles.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3 has-[:checked]:border-ink">
            <input type="checkbox" className="mt-0.5 accent-[#0A4152]" checked={roleIds.includes(r.id)} onChange={(e) => setRoleIds(e.target.checked ? [...roleIds, r.id] : roleIds.filter((x) => x !== r.id))} />
            <span><span className="block text-sm font-medium">{r.name}</span><span className="text-xs text-muted">{r.description}</span></span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
