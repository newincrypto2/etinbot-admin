import { prisma } from '@/lib/prisma'

export type EscalationRecipient = {
  id: string
  name: string
  phone: string
  role: 'office' | 'security' | 'manager' | 'owner' | string
  scope: string | null
  severityFilter: 'all' | 'urgent_only' | 'normal_only' | string
  smsEnabled: boolean
  isActive: boolean
  note: string | null
  createdAt: Date
  updatedAt: Date
}

export async function listEscalationRecipients(clientSlug: string): Promise<EscalationRecipient[]> {
  const rows = await prisma.escalation_recipients.findMany({
    where: { clients: { slug: clientSlug } },
    orderBy: [{ is_active: 'desc' }, { role: 'asc' }, { created_at: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    role: r.role,
    scope: r.scope,
    severityFilter: r.severity_filter,
    smsEnabled: r.sms_enabled,
    isActive: r.is_active,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export async function getEscalationRecipient(id: string): Promise<EscalationRecipient | null> {
  const r = await prisma.escalation_recipients.findUnique({ where: { id } })
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    role: r.role,
    scope: r.scope,
    severityFilter: r.severity_filter,
    smsEnabled: r.sms_enabled,
    isActive: r.is_active,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
