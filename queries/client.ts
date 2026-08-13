import { cache } from 'react'

import { prisma } from '@/lib/prisma'
import { coerceObj } from '@/queries/clients'

export type Vertical = 'rental' | 'ecommerce'

/** Vertical klienta — steruje całym UI panelu (rental = apartamenty/rezerwacje, ecommerce = sklep).
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
  /** Numery/email cytowane klientowi/gościowi przez bota — czytane z `config.escalation`
   *  (app/bot/prompts/common.py::_placeholders_from_config), NIE z kolumn
   *  escalation_phone_office/_security/escalation_email (martwe, audyt 08.2026). */
  escalationPhoneOffice: string | null
  escalationPhoneSecurity: string | null
  escalationEmail: string | null
  officeHours: Record<string, [number, number] | []> | null
  idobookingTenant: string | null
  idobookingLogin: string | null
  hasIdobookingApiKey: boolean    // tylko flag — nie zwracamy sekretu
  hasElevenlabsAgent: boolean
  elevenlabsAgentId: string | null
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
      config: true,
      office_hours: true,
      idobooking_tenant: true,
      idobooking_login: true,
      idobooking_api_key_enc: true,
      elevenlabs_agent_id: true,
      updated_at: true,
    },
  })
  if (!c) return null
  const escalation = coerceObj(coerceObj(c.config).escalation)
  const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    plan: c.plan,
    vertical: c.vertical === 'ecommerce' ? 'ecommerce' : 'rental',
    botName: c.bot_name,
    botPersona: c.bot_persona,
    primaryLanguage: c.primary_language,
    escalationPhoneOffice: strOrNull(escalation.phone),
    escalationPhoneSecurity: strOrNull(escalation.security_phone),
    escalationEmail: strOrNull(escalation.email),
    officeHours: (c.office_hours as any) ?? null,
    idobookingTenant: c.idobooking_tenant,
    idobookingLogin: c.idobooking_login,
    hasIdobookingApiKey: Boolean(c.idobooking_api_key_enc),
    hasElevenlabsAgent: Boolean(c.elevenlabs_agent_id),
    elevenlabsAgentId: c.elevenlabs_agent_id,
    updatedAt: c.updated_at,
  }
}

export type IdoBookingCreds = {
  id: string
  scope: string             // kod budynku tenanta (kebab-case)
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

/** Skąd naprawdę bierze się integracja: z panelu (config) czy z env Coolify backendu.
 *  `null` = ani panel, ani env — realnie nieskonfigurowana. */
export type IntegrationSource = 'panel' | 'env' | null

export type MessengerPageSummary = {
  pageId: string
  brandContext: string | null
  /** Zamaskowany token (długość, nie wartość) — nigdy plaintext w panelu tenanta. */
  tokenMasked: string | null
}

export type EcommerceIntegrations = {
  baselinkerTokenSet: boolean
  baselinkerSource: IntegrationSource
  wcUrl: string | null
  wcKeySet: boolean
  wcSecretSet: boolean
  wcSource: IntegrationSource
  twilioSmsNumber: string | null
  twilioSource: IntegrationSource
  messengerPageId: string | null
  messengerTokenSet: boolean
  messengerAppSecretSet: boolean
  messengerSource: IntegrationSource
  /** Realne strony FB spięte z tenantem (multi-page — tak działa produkcja).
   *  Puste = legacy pojedyncza strona (messengerPageId/*) albo brak. */
  messengerPages: MessengerPageSummary[]
  emailConfigured: boolean
  emailSource: IntegrationSource
  emailMailboxCount: number
  lastOrderSyncAt: Date | null
  lastProductSyncAt: Date | null
  ordersCount: number
  productsCount: number
}

/** Maska sekretu bez ekspozycji wartości — spójna z backendowym `_mask_secrets`
 *  (app/api/admin.py), ale liczona lokalnie (bez round-tripu do backendu tylko
 *  po to, żeby zamaskować długość stringa, który i tak już mamy przez Prisma). */
function maskSecretLen(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  const raw = v.startsWith('enc:v1:') ? v.slice('enc:v1:'.length) : v
  return `***(${raw.length})`
}

/** GET /api/admin/tenant-health — tylko dla `integration_sources` (panel/env),
 *  jedyna rzecz której panel NIE potrafi wyliczyć sam (env żyje na backendzie).
 *  Fail-safe: backend niedostępny → null, wołający degraduje do lokalnego configu. */
async function fetchIntegrationSources(slug: string): Promise<Record<string, IntegrationSource> | null> {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return null
  try {
    const res = await fetch(
      `${base.replace(/\/$/, '')}/api/admin/tenant-health?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { integration_sources?: Record<string, IntegrationSource> }
    return data.integration_sources ?? null
  } catch {
    return null
  }
}

export async function getEcommerceIntegrations(slug: string): Promise<EcommerceIntegrations | null> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { id: true, config: true } })
  if (!c) return null
  // config (jsonb) bywa stringiem przez driver adapter — bez coerce strona integracji
  // pokazywała puste pola (a zapis mógł nadpisać istniejące klucze)
  const rawCfg = typeof c.config === 'string'
    ? (() => { try { return JSON.parse(c.config as string) } catch { return {} } })()
    : (c.config ?? {})
  const integ = (((rawCfg as any)?.integrations) ?? {}) as Record<string, unknown>
  const [lastOrder, lastProduct, ordersCount, productsCount, sources] = await Promise.all([
    prisma.orders_cache.aggregate({ where: { client_id: c.id }, _max: { last_synced_at: true } }),
    prisma.products.aggregate({ where: { client_id: c.id }, _max: { last_synced_at: true } }),
    prisma.orders_cache.count({ where: { client_id: c.id } }),
    prisma.products.count({ where: { client_id: c.id } }),
    fetchIntegrationSources(slug),
  ])
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  // Fallback gdy backend niedostępny: znamy panel-config bezpośrednio (Prisma),
  // 'env' bez backendu wykryć się nie da — ale przynajmniej 'panel' nie znika.
  const srcOf = (key: string, panelPresent: boolean): IntegrationSource =>
    sources?.[key] ?? (panelPresent ? 'panel' : null)

  const rawPages = Array.isArray(integ.messenger_pages) ? integ.messenger_pages : []
  const messengerPages: MessengerPageSummary[] = rawPages
    .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
    .map((p) => ({
      pageId: str(p.page_id) ?? '',
      brandContext: str(p.brand_context),
      tokenMasked: maskSecretLen(p.page_token),
    }))
  const mailboxCount = Array.isArray(integ.email_mailboxes) ? integ.email_mailboxes.length : 0

  return {
    baselinkerTokenSet: Boolean(integ.baselinker_token),
    baselinkerSource: srcOf('baselinker', Boolean(integ.baselinker_token)),
    wcUrl: str(integ.wc_url),
    wcKeySet: Boolean(integ.wc_consumer_key),
    wcSecretSet: Boolean(integ.wc_consumer_secret),
    wcSource: srcOf('woocommerce', Boolean(integ.wc_url)),
    twilioSmsNumber: str(integ.twilio_sms_number),
    twilioSource: srcOf('twilio_sms', Boolean(integ.twilio_sms_number)),
    messengerPageId: str(integ.messenger_page_id),
    messengerTokenSet: Boolean(integ.messenger_page_token),
    messengerAppSecretSet: Boolean(integ.messenger_app_secret),
    messengerSource: srcOf('messenger', messengerPages.length > 0 || Boolean(integ.messenger_page_id)),
    messengerPages,
    emailConfigured: mailboxCount > 0,
    emailSource: srcOf('email', mailboxCount > 0),
    emailMailboxCount: mailboxCount,
    lastOrderSyncAt: lastOrder._max.last_synced_at,
    lastProductSyncAt: lastProduct._max.last_synced_at,
    ordersCount,
    productsCount,
  }
}
