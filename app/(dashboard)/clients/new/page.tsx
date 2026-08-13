import { requirePermission } from '@/lib/permissions'
import { ClientWizard } from './_components/ClientWizard'

export default async function NewClientPage() {
  await requirePermission('clients.manage')
  return <ClientWizard />
}
