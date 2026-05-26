import { getCurrentRole, requireAuth } from '@/lib/auth-helpers'
import { DashboardShell } from './_components/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  // DB fallback dla starych JWT bez `role`
  const role = (await getCurrentRole()) ?? 'VIEWER'

  return (
    <DashboardShell user={{ ...session.user, role }}>
      {children}
    </DashboardShell>
  )
}
