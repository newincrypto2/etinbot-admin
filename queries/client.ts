import { cache } from 'react'

import { prisma } from '@/lib/prisma'

export type Vertical = 'rental' | 'ecommerce'

/** Vertical klienta — steruje całym UI panelu (rental = Silver Place wzorzec, ecommerce = KH).
 *  Cache'owane per-request, bo czyta to wiele server-componentów w jednym renderze. */
export const getVertical = cache(async (slug: string): Promise<Vertical> => {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { vertical: true } })
  return c?.vertical === 'ecommerce' ? 'ecommerce' : 'rental'
})

export type ClientSettings = {
  id: string
  slug: string
  name: string
  vertical: Vertical
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
      vertical: true,
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
    vertical: c.vertical === 'ecommerce' ? 'ecommerce' : 'rental',
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

// ─── Ecommerce integrations (BaseLinker + WooCommerce) ──────────────────────
// Klucze trzymane w clients.config.integrations JSONB — backend EtinBOT czyta
// je stamtąd (z fallbackiem na env). Sekretów nie zwracamy, tylko flagę set/not.

export type EcommerceIntegrations = {
  baselinkerTokenSet: boolean
  wcUrl: string | null
  wcKeySet: boolean
  wcSecretSet: boolean
  twilioSmsNumber: string | null
  messengerPageId: string | null
  messengerTokenSet: boolean
  messengerAppSecretSet: boolean
  lastOrderSyncAt: Date | null
  lastProductSyncAt: Date | null
  ordersCount: number
  productsCount: number
}

export async function getEcommerceIntegrations(slug: string): Promise<EcommerceIntegrations | null> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { id: true, config: true } })
  if (!c) return null
  const integ = (((c.config as any)?.integrations) ?? {}) as Record<string, unknown>
  const [lastOrder, lastProduct, ordersCount, productsCount] = await Promise.all([
    prisma.orders_cache.aggregate({ where: { client_id: c.id }, _max: { last_synced_at: true } }),
    prisma.products.aggregate({ where: { client_id: c.id }, _max: { last_synced_at: true } }),
    prisma.orders_cache.count({ where: { client_id: c.id } }),
    prisma.products.count({ where: { client_id: c.id } }),
  ])
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    baselinkerTokenSet: Boolean(integ.baselinker_token),
    wcUrl: str(integ.wc_url),
    wcKeySet: Boolean(integ.wc_consumer_key),
    wcSecretSet: Boolean(integ.wc_consumer_secret),
    twilioSmsNumber: str(integ.twilio_sms_number),
    messengerPageId: str(integ.messenger_page_id),
    messengerTokenSet: Boolean(integ.messenger_page_token),
    messengerAppSecretSet: Boolean(integ.messenger_app_secret),
    lastOrderSyncAt: lastOrder._max.last_synced_at,
    lastProductSyncAt: lastProduct._max.last_synced_at,
    ordersCount,
    productsCount,
  }
}
