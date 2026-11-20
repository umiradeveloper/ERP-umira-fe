import {
  BarChart3, BookOpen, Building2, CheckSquare, ClipboardList, FileSignature, FileText, HardHat,
  LayoutDashboard, Receipt, Scale, ScrollText, Settings2, ShieldCheck, ShoppingCart, Truck, Users, Wallet, Warehouse,
} from 'lucide-react';
import { can, type SessionUser } from './api';

/** Katalog menu sidebar. Dipakai juga di halaman Role & menu untuk mengatur menu per role. */
export type NavItem = { href: string; label: string; icon: any; perm?: string; badge?: 'approvals'; fixed?: boolean };
export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: '',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, fixed: true },
      { href: '/approvals', label: 'Approval saya', icon: CheckSquare, badge: 'approvals', fixed: true },
    ],
  },
  {
    group: 'Komersial & proyek',
    items: [
      { href: '/tenders', label: 'Tender & BQ', icon: FileSignature, perm: 'tender:read' },
      { href: '/projects', label: 'Proyek', icon: HardHat, perm: 'project:read' },
      { href: '/cost', label: 'Cost control', icon: BarChart3, perm: 'cost:read' },
    ],
  },
  {
    group: 'Pengadaan',
    items: [
      { href: '/procurement/pr', label: 'Purchase request', icon: ClipboardList, perm: 'procurement:read' },
      { href: '/procurement/rfq', label: 'RFQ & penawaran', icon: Scale, perm: 'procurement:read' },
      { href: '/procurement/po', label: 'Purchase order', icon: ShoppingCart, perm: 'procurement:read' },
    ],
  },
  {
    group: 'Keuangan',
    items: [
      { href: '/finance/invoices', label: 'Penagihan & piutang', icon: Receipt, perm: 'finance:read' },
      { href: '/finance/ap', label: 'Hutang supplier', icon: Wallet, perm: 'finance:read' },
      { href: '/accounting/journals', label: 'Jurnal', icon: BookOpen, perm: 'accounting:read' },
      { href: '/accounting/reports', label: 'Laporan keuangan', icon: FileText, perm: 'accounting:read' },
    ],
  },
  {
    group: 'Aset & gudang',
    items: [
      { href: '/assets', label: 'Aset & alat', icon: Truck, perm: 'asset:read' },
      { href: '/inventory', label: 'Gudang & stok', icon: Warehouse, perm: 'warehouse:read' },
    ],
  },
  {
    group: 'Pengaturan',
    items: [
      { href: '/master', label: 'Customer & supplier', icon: Building2, perm: 'master:read' },
      { href: '/admin/users', label: 'User', icon: Users, perm: 'admin:read' },
      { href: '/admin/roles', label: 'Role & menu', icon: ShieldCheck, perm: 'admin:read' },
      { href: '/admin/workflows', label: 'Alur approval', icon: Settings2, perm: 'admin:read' },
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText, perm: 'audit:read' },
    ],
  },
];


/** Menu tampil bila user punya hak akses modulnya dan (bila role membatasi menu) menu itu dipilih untuk rolenya */
export function canSeeMenu(user: SessionUser | null | undefined, i: NavItem) {
  if (!user) return false;
  if (i.perm && !can(user, i.perm)) return false;
  if (i.fixed || !Array.isArray(user.menus)) return true;
  return user.menus.includes(i.href);
}

/** Item menu yang membawahi path ini (mis. /projects/123 → Proyek) */
export function menuForPath(path: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const g of NAV) for (const i of g.items) if ((path === i.href || path.startsWith(i.href + '/')) && (!best || i.href.length > best.href.length)) best = i;
  return best;
}
