import { getFreshSessionUser, requireAuth } from '@/lib/auth-helpers'
import { getCurrentPermissions } from '@/lib/permissions'
import { DashboardShell } from './_components/DashboardShell'
import { TenantSelector } from '@/components/layout/TenantSelector'
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

  // Aktywny tenant — potrzebny wszystkim (vertical steruje nawigacją w Sidebarze).
  // activeClient() jest cache() per-request, więc kolejne wywołania w stronach nie kosztują.
  const active = await activeClient()

  // Selektor tenanta: tylko SUPERADMIN bez przypisanego klienta (S1 multi-tenant)
  let tenantSelector: React.ReactNode = null
  const userClientId = fresh?.clientId ?? null
  if (role === 'SUPERADMIN' && !userClientId) {
    const tenants = await prisma.clients.findMany({
      select: { slug: true, name: true, vertical: true },
      orderBy: { name: 'asc' },
    })
    tenantSelector = <TenantSelector tenants={tenants} active={active.slug} />
  }

  // Imię z DB, nie z JWT — po edycji na /konto nagłówek pokazuje nowe od razu.
  const freshName = fresh?.name ?? session.user?.name

  return (
    <DashboardShell
      user={{ ...session.user, name: freshName, role }}
      permissions={permissions}
      tenantSelector={tenantSelector}
      vertical={active.vertical}
    >
      {children}
    </DashboardShell>
  )
}
