import { getFreshSessionUser, requireAuth } from '@/lib/auth-helpers'
import { getCurrentPermissions } from '@/lib/permissions'
import { getActiveModules } from '@/lib/modules-server'
import { DashboardShell } from './_components/DashboardShell'
import { activeClient } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  // getFreshSessionUser() jest cache()'owane per request — requireAuth() już
  // je odpytało (sprawdzając sessionVersion), więc to nie jest drugie
  // zapytanie do DB. Daje nam świeżą rolę I imię jednym strzałem (zamiast
  // dwóch osobnych zapytań jak poprzednio).
  const fresh = await getFreshSessionUser()
  const role = fresh?.role ?? 'VIEWER'
  const permissions = await getCurrentPermissions()

  // Aktywny tenant — potrzebny wszystkim (vertical steruje domyślkami modułów,
  // kafel w sidebarze pokazuje jego nazwę/plakietkę).
  // activeClient() jest cache() per-request, więc kolejne wywołania w stronach nie kosztują.
  const active = await activeClient()

  // Efektywny stan modułów tenanta (core + defaultFor verticala + override'y
  // z config.modules) — steruje widocznością pozycji w Sidebarze i paletą
  // Ctrl+K w Headerze. cache() per request, jak wyżej.
  const modules = await getActiveModules()

  // Kafel tenanta w sidebarze: tylko SUPERADMIN bez przypisanego klienta widzi
  // listę do przełączania (S1 multi-tenant) — reszta userów dostaje kafel
  // statyczny (tenantList = null → TenantTile bez rozwijania).
  let tenantList: { slug: string; name: string; vertical: string | null }[] | null = null
  const userClientId = fresh?.clientId ?? null
  if (role === 'SUPERADMIN' && !userClientId) {
    tenantList = await prisma.clients.findMany({
      select: { slug: true, name: true, vertical: true },
      orderBy: { name: 'asc' },
    })
  }

  // Imię z DB, nie z JWT — po edycji na /konto nagłówek pokazuje nowe od razu.
  const freshName = fresh?.name ?? session.user?.name

  return (
    <DashboardShell
      user={{ ...session.user, name: freshName, role }}
      permissions={permissions}
      modules={modules}
      vertical={active.vertical}
      activeTenant={{ slug: active.slug, name: active.name, vertical: active.vertical }}
      tenantList={tenantList}
    >
      {children}
    </DashboardShell>
  )
}
