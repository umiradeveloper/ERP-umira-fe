'use client';

import { Check, Lock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, Empty, Field, Input, Loading, Modal, PageHeader, Panel, Table, Tabs, Td, Th } from '@/components/ui';
import { api, can, useApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { NAV } from '@/lib/menu';

type Role = { id: string; name: string; description: string | null; permissions: string[]; menus: string[] | null; users: number; system: boolean };
type Mod = { key: string; label: string; levels: ('read' | 'write')[] };
type Tab = 'roles' | 'superapps';

export default function RolesPage() {
  const { user } = useAuth();
  const write = can(user, 'admin:write');
  const sa = useApi<any>('/superapps/status');
  const [tab, setTab] = useState<Tab>('roles');
  const saEnabled = !!sa.data?.enabled;
  return (
    <div className="animate-rise">
      <PageHeader
        title="Role & menu"
        description="Atur hak akses dan menu yang tampil untuk setiap role. Berlaku juga untuk user dari SuperApps lewat pemetaan role."
      />
      {saEnabled && (
        <Tabs<Tab> value={tab} onChange={setTab} items={[{ value: 'roles', label: 'Role & menu' }, { value: 'superapps', label: 'Pemetaan role SuperApps' }]} />
      )}
      {tab === 'roles' || !saEnabled ? <RolesTab write={write} /> : <SuperAppsTab write={write} />}
    </div>
  );
}

/* ───────────────────────── Role & menu ───────────────────────── */

const hasPerm = (perms: string[], p: string) => {
  if (perms.includes('*') || perms.includes(p)) return true;
  const [m, a] = p.split(':');
  return a === 'read' && perms.includes(`${m}:write`);
};
const levelOf = (perms: string[], m: string): '' | 'read' | 'write' => (perms.includes(`${m}:write`) ? 'write' : perms.includes(`${m}:read`) ? 'read' : '');
const ALL_MENU_ITEMS = NAV.flatMap((g) => g.items);

function RolesTab({ write }: { write: boolean }) {
  const roles = useApi<Role[]>('/roles');
  const cat = useApi<{ modules: Mod[] }>('/roles/catalog');
  const [sel, setSel] = useState<string | 'new' | null>(null);

  useEffect(() => {
    if (!sel && roles.data?.length) setSel(roles.data.find((r) => !r.system)?.id ?? roles.data[0].id);
  }, [roles.data, sel]);

  if (!roles.data || !cat.data) return <Loading />;
  const role = sel === 'new' ? null : roles.data.find((r) => r.id === sel) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Panel title="Role" bodyClass="p-0" actions={write && <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setSel('new')}>Role baru</Button>}>
        <ul className="divide-y divide-line">
          {roles.data.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setSel(r.id)}
                className={cn('flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-hover', sel === r.id && 'bg-hover')}>
                <span className={cn('min-w-0 flex-1 truncate', sel === r.id && 'font-semibold text-ink')}>{r.name}</span>
                {r.system && <Lock className="size-3.5 text-faint" aria-label="Akses penuh" />}
                <span className="num text-xs text-muted">{r.users}</span>
              </button>
            </li>
          ))}
          {sel === 'new' && <li className="bg-hover px-4 py-2.5 text-sm font-semibold text-ink">Role baru…</li>}
        </ul>
      </Panel>
      {sel && (
        <RoleEditor
          key={sel}
          role={role}
          modules={cat.data.modules}
          write={write}
          onSaved={(id) => { roles.reload(); setSel(id); }}
          onDeleted={() => { roles.reload(); setSel(null); }}
        />
      )}
    </div>
  );
}

function RoleEditor({ role, modules, write, onSaved, onDeleted }: { role: Role | null; modules: Mod[]; write: boolean; onSaved: (id: string) => void; onDeleted: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [desc, setDesc] = useState(role?.description ?? '');
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  const [menus, setMenus] = useState<string[] | null>(role ? role.menus : null);
  const [busy, setBusy] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const system = !!role?.system;
  const editable = write && !system;

  const setLevel = (m: string, lvl: '' | 'read' | 'write') => setPerms((ps) => [...ps.filter((p) => !p.startsWith(`${m}:`)), ...(lvl ? [`${m}:${lvl}`] : [])]);
  const available = (i: (typeof ALL_MENU_ITEMS)[number]) => !i.perm || hasPerm(perms, i.perm);
  const shown = (i: (typeof ALL_MENU_ITEMS)[number]) => available(i) && (i.fixed || menus === null || menus.includes(i.href));
  const toggleMenu = (href: string, on: boolean) => {
    const base = menus ?? ALL_MENU_ITEMS.filter((i) => !i.fixed && available(i)).map((i) => i.href);
    setMenus(on ? [...new Set([...base, href])] : base.filter((x) => x !== href));
  };
  const count = useMemo(() => ALL_MENU_ITEMS.filter(shown).length, [perms, menus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (name.trim().length < 2) return toast.error('Nama role minimal 2 karakter');
    setBusy('save');
    try {
      const body = { name: name.trim(), description: desc.trim() || undefined, permissions: perms.filter((p) => p !== '*'), menus: menus === null ? null : menus.filter((h) => ALL_MENU_ITEMS.some((i) => i.href === h && available(i))) };
      const r = role ? await api<Role>(`/roles/${role.id}`, { method: 'PATCH', body }) : await api<Role>('/roles', { body });
      toast.success(role ? 'Role disimpan. Berlaku saat user membuka/memuat ulang aplikasi.' : 'Role dibuat');
      onSaved(r.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }
  async function remove() {
    if (!role) return;
    setBusy('del');
    try {
      await api(`/roles/${role.id}`, { method: 'DELETE' });
      toast.success('Role dihapus');
      onDeleted();
    } catch (e: any) {
      toast.error(e.message);
      setBusy('');
      setConfirmDel(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel
        title={role ? role.name : 'Role baru'}
        subtitle={role ? `${role.users} user memakai role ini` : 'Tentukan hak akses dan menu, lalu simpan.'}
        actions={write && (
          <div className="flex gap-2">
            {role && !system && <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDel(true)}>Hapus</Button>}
            <Button size="sm" onClick={save} loading={busy === 'save'}>Simpan</Button>
          </div>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama role"><Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} disabled={!write} /></Field>
          <Field label="Keterangan"><Input value={desc} maxLength={190} onChange={(e) => setDesc(e.target.value)} disabled={!write} placeholder="Mis. Staf gudang proyek" /></Field>
        </div>
        {system && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-sm text-info">
            <Lock className="size-4 shrink-0" /> Role ini punya akses penuh ke semua modul dan menu, supaya selalu ada admin yang bisa masuk. Hanya nama dan keterangannya yang bisa diubah.
          </p>
        )}
      </Panel>

      {!system && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Hak akses modul" subtitle="Lihat = hanya membaca. Kelola = membuat, mengubah dan mengajukan." bodyClass="p-0">
            <Table>
              <thead><tr><Th>Modul</Th><Th className="w-[230px]">Akses</Th></tr></thead>
              <tbody>
                {modules.map((m) => {
                  const lvl = levelOf(perms, m.key);
                  const opts: ['' | 'read' | 'write', string][] = [['', 'Tidak ada'], ...m.levels.map((l) => [l, l === 'read' ? 'Lihat' : 'Kelola'] as ['read' | 'write', string])];
                  return (
                    <tr key={m.key} className="border-t border-line">
                      <Td>{m.label}</Td>
                      <Td>
                        <div className="inline-flex rounded-lg border border-line-strong p-0.5">
                          {opts.map(([v, l]) => (
                            <button key={v || 'none'} type="button" disabled={!editable} onClick={() => setLevel(m.key, v)}
                              className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default',
                                lvl === v ? (v ? 'bg-ink text-white' : 'bg-canvas text-ink') : 'text-muted hover:text-ink')}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Panel>

          <Panel
            title="Menu yang tampil"
            subtitle={`${count} menu tampil di sidebar untuk role ini`}
            actions={editable && (
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" className="accent-[#0A4152]" checked={menus === null} onChange={(e) => setMenus(e.target.checked ? null : ALL_MENU_ITEMS.filter((i) => !i.fixed && available(i)).map((i) => i.href))} />
                Semua menu sesuai hak akses
              </label>
            )}
          >
            <div className="space-y-4">
              {NAV.map((g) => (
                <div key={g.group || 'utama'}>
                  <div className="mb-1.5 text-xs font-medium text-muted">{g.group || 'Utama'}</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {g.items.map((i) => {
                      const avail = available(i);
                      const on = shown(i);
                      const Icon = i.icon;
                      return (
                        <label key={i.href} title={!avail ? 'Beri hak akses modulnya dulu' : i.fixed ? 'Selalu tampil' : undefined}
                          className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
                            on ? 'border-ink/30 bg-surface' : 'border-line bg-canvas/50 text-muted',
                            (!avail || i.fixed || menus === null || !editable) ? 'cursor-default' : 'cursor-pointer hover:border-ink/50')}>
                          <input type="checkbox" className="accent-[#0A4152]" checked={on} disabled={!editable || !avail || !!i.fixed || menus === null}
                            onChange={(e) => toggleMenu(i.href, e.target.checked)} />
                          <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                          <span className="flex-1">{i.label}</span>
                          {!avail && <span className="text-[11px] text-faint">tanpa akses</span>}
                          {i.fixed && <span className="text-[11px] text-faint">selalu</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted">
                Menyembunyikan menu juga menutup halamannya untuk role ini. Dashboard dan Approval saya selalu tampil.
                Bila user punya beberapa role, menu yang tampil adalah gabungan dari semua rolenya.
              </p>
            </div>
          </Panel>
        </div>
      )}

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Hapus role?"
        footer={<><Button variant="secondary" onClick={() => setConfirmDel(false)}>Batal</Button><Button variant="danger" onClick={remove} loading={busy === 'del'}>Hapus role</Button></>}>
        <p className="text-sm">Role <b>{role?.name}</b> akan dihapus. Role yang masih dipakai user atau pemetaan SuperApps tidak bisa dihapus.</p>
      </Modal>
    </div>
  );
}

/* ───────────────────── Pemetaan role SuperApps ───────────────────── */

type SaRow = { name: string; users: number | null; approved: number | null; erpRoles: string[] };

function SuperAppsTab({ write }: { write: boolean }) {
  const map = useApi<{ enabled: boolean; source: 'file' | 'database'; saError: string | null; roles: SaRow[] }>('/superapps/role-map');
  const roles = useApi<Role[]>('/roles');
  const [rows, setRows] = useState<SaRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<SaRow | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (map.data) {
      setRows(map.data.roles);
      setDirty(false);
    }
  }, [map.data]);

  if (!map.data || !roles.data) return <Loading />;
  const list = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.erpRoles.some((x) => x.toLowerCase().includes(q.toLowerCase())));
  const withAccess = rows.filter((r) => r.erpRoles.length).length;

  async function save() {
    setBusy('save');
    try {
      await api('/superapps/role-map', { method: 'PUT', body: { map: Object.fromEntries(rows.map((r) => [r.name, r.erpRoles])) } });
      toast.success('Pemetaan disimpan. Berlaku saat user SuperApps login berikutnya atau setelah sinkron.');
      map.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }
  async function sync() {
    setBusy('sync');
    try {
      const r = await api('/superapps/sync-users', { body: {} });
      toast.success(`Sinkron: ${r.created} user baru, ${r.updated} diperbarui, ${r.deactivated} dinonaktifkan`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <Panel
      title="Role SuperApps → role ERP"
      subtitle={`${withAccess} dari ${rows.length} role SuperApps boleh masuk ERP. Menu dan hak akses user mengikuti role ERP yang dipetakan.`}
      bodyClass="p-0"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari role" className="h-8 w-44 text-[13px]" />
          {write && <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} loading={busy === 'sync'} disabled={dirty} onClick={sync}>Sinkron user</Button>}
          {write && <Button size="sm" onClick={save} loading={busy === 'save'} disabled={!dirty}>Simpan pemetaan</Button>}
        </div>
      }
    >
      {map.data.source === 'file' && (
        <p className="border-b border-line bg-canvas/60 px-5 py-2.5 text-xs text-muted">
          Saat ini pemetaan masih dibaca dari file <code>superapps-role-map.json</code>. Setelah disimpan dari halaman ini, pemetaan disimpan di database dan file tidak dipakai lagi.
        </p>
      )}
      {map.data.saError && <p className="border-b border-line bg-warn-soft px-5 py-2.5 text-xs text-warn">{map.data.saError}</p>}
      {dirty && <p className="border-b border-line bg-signal-soft px-5 py-2.5 text-xs text-signal-ink">Ada perubahan yang belum disimpan.</p>}
      {!list.length ? <Empty title="Tidak ada role" /> : (
        <Table>
          <thead><tr><Th>Role SuperApps</Th><Th right className="w-28">User aktif</Th><Th>Role ERP</Th>{write && <Th className="w-24" />}</tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.name} className="border-t border-line">
                <Td className="font-medium">{r.name}</Td>
                <Td right className="num text-muted">{r.approved === null ? '—' : `${r.approved}${r.users !== r.approved ? ` / ${r.users}` : ''}`}</Td>
                <Td>
                  {r.erpRoles.length ? (
                    <div className="flex flex-wrap gap-1">{r.erpRoles.map((x) => <Badge key={x} label={x} tone="info" />)}</div>
                  ) : <span className="text-xs text-muted">Tidak boleh masuk ERP</span>}
                </Td>
                {write && <Td right><Button size="sm" variant="ghost" onClick={() => setEdit(r)}>Ubah</Button></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {edit && (
        <PickRoles
          row={edit}
          roles={roles.data}
          onClose={() => setEdit(null)}
          onPick={(erpRoles) => {
            setRows((rs) => rs.map((x) => (x.name === edit.name ? { ...x, erpRoles } : x)));
            setDirty(true);
            setEdit(null);
          }}
        />
      )}
    </Panel>
  );
}

function PickRoles({ row, roles, onClose, onPick }: { row: SaRow; roles: Role[]; onClose: () => void; onPick: (r: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(row.erpRoles);
  return (
    <Modal open onClose={onClose} title={`Role ERP untuk "${row.name}"`}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={() => onPick(sel)}>Terapkan</Button></>}>
      <p className="mb-3 text-sm text-muted">Pilih satu atau beberapa role. Kosongkan semua bila role ini tidak boleh masuk ERP.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((r) => {
          const on = sel.includes(r.name);
          return (
            <button key={r.id} type="button" onClick={() => setSel(on ? sel.filter((x) => x !== r.name) : [...sel, r.name])}
              className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm', on ? 'border-ink bg-ink/5' : 'border-line hover:border-ink/40')}>
              <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border', on ? 'border-ink bg-ink text-white' : 'border-line-strong')}>{on && <Check className="size-3" />}</span>
              <span className="min-w-0">
                <span className="block font-medium">{r.name}</span>
                {r.description && <span className="block text-xs text-muted">{r.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
