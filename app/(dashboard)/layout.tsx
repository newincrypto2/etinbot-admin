import { getCurrentRole, requireAuth } from '@/lib/auth-helpers'
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
  // DB fallback dla starych JWT bez `role`
  const role = (await getCurrentRole()) ?? 'VIEWER'

  // Selektor tenanta: tylko SUPERADMIN bez przypisanego klienta (S1 multi-tenant)
  let tenantSelector: React.ReactNode = null
  const userClientId = (session.user as { clientId?: string | null }).clientId
  if (role === 'SUPERADMIN' && !userClientId) {
    const [tenants, active] = await Promise.all([
      prisma.clients.findMany({ select: { slug: true, name: true, vertical: true }, orderBy: { name: 'asc' } }),
      activeClient(),
    ])
    tenantSelector = <TenantSelector tenants={tenants} active={active.slug} />
  }

  return (
    <DashboardShell user={{ ...session.user, role }} tenantSelector={tenantSelector}>
      {children}
    </DashboardShell>
  )
}
