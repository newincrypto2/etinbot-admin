import { prisma } from '@/lib/prisma'

// ─── Coerce helpers (jsonb z Prisma driver adapter bywa STRINGIEM) ──────────

export function coerceObj(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function coerceArr(v: unknown): unknown[] {
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return Array.isArray(v) ? v : []
}

// ─── Channel presence (mirror backend tenant_health.integrations) ───────────

export type ClientChannels = {
  webchat: boolean
  email: boolean
  messenger: boolean
  sms: boolean
  voice: boolean
  allegro: boolean
  woocommerce: boolean
  baselinker: boolean
}

function channelsFromConfig(config: unknown, elevenlabsAgentId: string | null): ClientChannels {
  const cfg = coerceObj(config)
  const integ = coerceObj(cfg.integrations)
  const mailboxes = coerceArr(integ.email_mailboxes)
  const messengerPages = coerceArr(integ.messenger_pages)
  const allegro = coerceObj(integ.allegro)
  return {
    webchat: true, // nie wymaga credsów — wystarczy snippet ze slugiem
    email: mailboxes.length > 0,
    messenger: messengerPages.length > 0 || Boolean(integ.messenger_page_id),
    sms: Boolean(integ.twilio_sms_number),
    voice: Boolean(elevenlabsAgentId),
    allegro: Boolean(allegro.refresh_token),
    woocommerce: Boolean(integ.wc_url),
    baselinker: Boolean(integ.baselinker_token),
  }
}

// ─── Lista klientów (SUPERADMIN) ────────────────────────────────────────────

export type ClientListRow = {
  id: string
  slug: string
  name: string
  vertical: string | null
  active: boolean
  enabledChannels: string[]
  channels: ClientChannels
  conversations7d: number
  createdAt: Date
  elevenlabsAgentId: string | null
}

export async function listClients(): Promise<ClientListRow[]> {
  const clients = await prisma.clients.findMany({
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      vertical: true,
      active: true,
      enabled_channels: true,
      config: true,
      elevenlabs_agent_id: true,
      created_at: true,
    },
  })

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const grouped = await prisma.conversations.groupBy({
    by: ['client_id'],
    where: { last_message_at: { gt: since } },
    _count: { _all: true },
  })
  const convMap = new Map(grouped.map((g) => [g.client_id, g._count._all]))

  return clients.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    vertical: c.vertical,
    active: c.active,
    enabledChannels: coerceArr(c.enabled_channels).filter((x): x is string => typeof x === 'string'),
    channels: channelsFromConfig(c.config, c.elevenlabs_agent_id),
    conversations7d: convMap.get(c.id) ?? 0,
    createdAt: c.created_at,
    elevenlabsAgentId: c.elevenlabs_agent_id,
  }))
}

// ─── Karta klienta ──────────────────────────────────────────────────────────

const SECRET_KEY_RE = /(_token|_secret|_pass|_password|_key|consumer_key|api_key)$/i

/** Maskuje wartości sekretów w configu (do readonly podglądu). */
function maskSecrets(value: unknown, keyHint?: string): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('enc:v1:')) return '•••'
    if (keyHint && SECRET_KEY_RE.test(keyHint) && value.length > 0) return '•••'
    return value
  }
  if (Array.isArray(value)) return value.map((v) => maskSecrets(v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = maskSecrets(v, k)
    }
    return out
  }
  return value
}

export type ClientCard = {
  id: string
  slug: string
  name: string
  vertical: string | null
  active: boolean
  enabledChannels: string[]
  channels: ClientChannels
  elevenlabsAgentId: string | null
  createdAt: Date
  promptExtra: string
  configMaskedJson: string
}

export async function getClientBySlug(slug: string): Promise<ClientCard | null> {
  const c = await prisma.clients.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      vertical: true,
      active: true,
      enabled_channels: true,
      config: true,
      elevenlabs_agent_id: true,
      created_at: true,
    },
  })
  if (!c) return null
  const cfg = coerceObj(c.config)
  const promptExtraRaw = cfg.prompt_extra
  const promptExtra = typeof promptExtraRaw === 'string' ? promptExtraRaw : ''
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    vertical: c.vertical,
    active: c.active,
    enabledChannels: coerceArr(c.enabled_channels).filter((x): x is string => typeof x === 'string'),
    channels: channelsFromConfig(c.config, c.elevenlabs_agent_id),
    elevenlabsAgentId: c.elevenlabs_agent_id,
    createdAt: c.created_at,
    promptExtra,
    configMaskedJson: JSON.stringify(maskSecrets(cfg), null, 2),
  }
}

export type ClientUserRow = {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
}

export async function listClientUsers(clientId: string): Promise<ClientUserRow[]> {
  const users = await prisma.adminUser.findMany({
    where: { clientId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })
  return users
}

/** Czy slug jest wolny (walidacja unikalności w wizardzie). */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const existing = await prisma.clients.findUnique({ where: { slug }, select: { id: true } })
  return !existing
}

// ─── Tenant health (fetch z backendu EtinBOT) ───────────────────────────────

export type TenantHealth = {
  slug: string
  name: string
  vertical: string | null
  active: boolean
  status: 'healthy' | 'degraded' | 'inactive'
  problems: string[]
  enabled_channels: string[]
  integrations: Record<string, boolean>
  products: { total_active: number; with_embedding: number; last_sync: string | null }
  orders: { total: number; last_sync: string | null }
  conversations: { total: number; last_7d: number; last_message_at: string | null }
  escalations: { open: number; last_7d: number }
  email: { mailboxes: number; last_inbound: string | null; stuck: number }
  faq_entries: number
  created_at: string | null
  checked_at: string
}

export async function getTenantHealth(
  slug: string,
): Promise<{ ok: true; health: TenantHealth } | { ok: false; error: string }> {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return { ok: false, error: 'Brak BOT_API_URL / BOT_API_KEY w env panelu.' }
  try {
    const res = await fetch(
      `${base.replace(/\/$/, '')}/api/admin/tenant-health?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, error: `Backend zwrócił ${res.status}. ${t.slice(0, 160)}` }
    }
    const health = (await res.json()) as TenantHealth
    return { ok: true, health }
  } catch (e) {
    return { ok: false, error: `Nie udało się połączyć z backendem: ${e instanceof Error ? e.message : String(e)}` }
  }
}
