import { prisma } from '@/lib/prisma'

export type ClientSettings = {
  id: string
  slug: string
  name: string
  botName: string | null
  botPersona: string | null
  primaryLanguage: string
  escalationPhoneOffice: string | null
  escalationPhoneSecurity: string | null
  escalationEmail: string | null
  officeHours: Record<string, [number, number] | []> | null
  idobookingTenant: string | null
  idobookingLogin: string | null
  hasIdobookingApiKey: boolean    // tylko flag — nie zwracamy sekretu
  hasElevenlabsAgent: boolean
  plan: string
  updatedAt: Date
}

export async function getClientSettings(slug: string): Promise<ClientSettings | null> {
  const c = await prisma.clients.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      bot_name: true,
      bot_persona: true,
      primary_language: true,
      escalation_phone_office: true,
      escalation_phone_security: true,
      escalation_email: true,
      office_hours: true,
      idobooking_tenant: true,
      idobooking_login: true,
      idobooking_api_key_enc: true,
      elevenlabs_agent_id: true,
      updated_at: true,
    },
  })
  if (!c) return null
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    plan: c.plan,
    botName: c.bot_name,
    botPersona: c.bot_persona,
    primaryLanguage: c.primary_language,
    escalationPhoneOffice: c.escalation_phone_office,
    escalationPhoneSecurity: c.escalation_phone_security,
    escalationEmail: c.escalation_email,
    officeHours: (c.office_hours as any) ?? null,
    idobookingTenant: c.idobooking_tenant,
    idobookingLogin: c.idobooking_login,
    hasIdobookingApiKey: Boolean(c.idobooking_api_key_enc),
    hasElevenlabsAgent: Boolean(c.elevenlabs_agent_id),
    updatedAt: c.updated_at,
  }
}

export type IdoBookingCreds = {
  id: string
  scope: string             // 'silver-place' | 'silver-forest'
  tenant: string
  systemLogin: string
  hasPassword: boolean      // tylko flag — nie zwracamy hasła
  apiVersion: number
  isActive: boolean
  lastSyncAt: Date | null
  lastError: string | null
  lastErrorAt: Date | null
  updatedAt: Date
}

export async function listIdobookingCreds(clientSlug: string): Promise<IdoBookingCreds[]> {
  const rows = await prisma.idobooking_credentials.findMany({
    where: { clients: { slug: clientSlug } },
    orderBy: { scope: 'asc' },
    select: {
      id: true,
      scope: true,
      tenant: true,
      system_login: true,
      api_password: true,    // tylko żeby sprawdzić Boolean(.)
      api_version: true,
      is_active: true,
      last_sync_at: true,
      last_error: true,
      last_error_at: true,
      updated_at: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    scope: r.scope,
    tenant: r.tenant,
    systemLogin: r.system_login,
    hasPassword: Boolean(r.api_password),
    apiVersion: r.api_version,
    isActive: r.is_active,
    lastSyncAt: r.last_sync_at,
    lastError: r.last_error,
    lastErrorAt: r.last_error_at,
    updatedAt: r.updated_at,
  }))
}
