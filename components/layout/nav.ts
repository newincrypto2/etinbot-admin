// ============================================================
// Nawigacja panelu — jedno źródło prawdy dla Sidebara i Headera
// ============================================================
// Buduje pogrupowane menu (Sidebar) i płaską listę pozycji (paleta Ctrl+K
// w Headerze, wyprowadzenie tytułu strony) z rejestru MODULES
// (lib/modules.ts) + efektywnych modules/permissions aktywnego tenanta.
// Wcześniej to były dwie zaszyte na sztywno tablice (navItems/rentalNavItems)
// w Sidebar.tsx — teraz jedna funkcja, dwa widoki tych samych danych.
//
// WAŻNE — parytet KH: tenant ecommerce bez override'ów w config.modules
// (m.in. KrainaHerbaty) musi dostać identyczny zestaw pozycji jak dawne
// navItems. Gwarantuje to lib/modules.ts (MODULES[].defaultFor) — nie
// zmieniaj tu filtrowania bez świadomości, że to dotyka produkcji KH.

import {
  LayoutDashboard,
  Mail,
  MessageCircle,
  AlertTriangle,
  Package,
  ShoppingCart,
  PackagePlus,
  Undo2,
  Calculator,
  Megaphone,
  BedDouble,
  CalendarCheck,
  HelpCircle,
  GraduationCap,
  Coins,
  Building2,
  Users,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react'

import {
  MODULES,
  MODULE_GROUP_ORDER,
  MODULE_GROUP_LABELS,
  type ModuleId,
  type ModuleGroup,
} from '@/lib/modules'
import type { PermissionKey } from '@/lib/permissions'

// Mapa nazwa ikony (ModuleDef.icon, string) → komponent lucide. Klucze muszą
// pokrywać się z polem `icon` w lib/modules.ts.
export const MODULE_ICONS: Record<string, LucideIcon> = {
  Mail,
  MessageCircle,
  AlertTriangle,
  Package,
  ShoppingCart,
  PackagePlus,
  Undo2,
  Calculator,
  Megaphone,
  BedDouble,
  CalendarCheck,
  HelpCircle,
  GraduationCap,
  Coins,
}

export type NavItem = { href: string; label: string; icon: LucideIcon }

// Dashboard nie jest modułem (zawsze widoczny, core faktyczny) — stała
// pierwsza pozycja grupy Operacje.
export const DASHBOARD_ITEM: NavItem = { href: '/', label: 'Dashboard', icon: LayoutDashboard }

type AdminNavItem = NavItem & { perm: PermissionKey }

// Sekcja admina w grupie Platforma — dotychczasowe pozycje spoza rejestru
// modułów (zarządzanie samym panelem, nie botem).
const ADMIN_ITEMS: AdminNavItem[] = [
  { href: '/clients', label: 'Klienci', icon: Building2, perm: 'clients.manage' },
  { href: '/settings/users', label: 'Użytkownicy', icon: Users, perm: 'users.manage' },
  { href: '/settings', label: 'Ustawienia', icon: Settings, perm: 'settings.manage' },
]

export type NavGroup = { key: ModuleGroup; label: string; items: NavItem[] }

/**
 * Pogrupowane menu sidebara. Pozycja widoczna gdy moduł jest aktywny dla
 * tenanta ORAZ user ma wymagane uprawnienie (permissions[perm] !== false —
 * brak klucza = widoczna, tak jak w dotychczasowym filtrze). Puste grupy są
 * pomijane.
 */
export function buildNavGroups(
  modules: Record<ModuleId, boolean>,
  permissions: Record<string, boolean>
): NavGroup[] {
  const groups: NavGroup[] = []
  for (const group of MODULE_GROUP_ORDER) {
    const items: NavItem[] = []
    if (group === 'operacje') items.push(DASHBOARD_ITEM)
    for (const m of MODULES) {
      if (m.group !== group) continue
      if (!modules[m.id]) continue
      if (permissions[m.perm] === false) continue
      items.push({ href: m.href, label: m.label, icon: MODULE_ICONS[m.icon] ?? Package })
    }
    if (group === 'platforma') {
      for (const a of ADMIN_ITEMS) {
        if (!permissions[a.perm]) continue
        items.push(a)
      }
    }
    if (items.length) groups.push({ key: group, label: MODULE_GROUP_LABELS[group], items })
  }
  return groups
}

/**
 * Płaska lista pozycji do palety wyszukiwania (Ctrl+K) w Headerze i do
 * wyprowadzenia tytułu bieżącej strony — te same dane co Sidebar, plus
 * „Moje konto" (dostępne wszystkim, poza rejestrem modułów).
 */
export function buildFlatNavItems(
  modules: Record<ModuleId, boolean>,
  permissions: Record<string, boolean>
): NavItem[] {
  const items = buildNavGroups(modules, permissions).flatMap((g) => g.items)
  items.push({ href: '/konto', label: 'Moje konto', icon: User })
  return items
}
