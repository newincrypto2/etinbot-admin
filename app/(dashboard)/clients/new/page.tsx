import { requireRole } from '@/lib/auth-helpers'
import { ClientWizard } from './_components/ClientWizard'

export default async function NewClientPage() {
  await requireRole('SUPERADMIN')
  return <ClientWizard />
}
