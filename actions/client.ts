'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertPermissionOrFail } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { activeClientSlug } from '@/lib/tenant'
import { coerceObj } from '@/queries/clients'
import { saveEscalationConfigPatch } from '@/lib/escalation-config'

const BrandSchema = z.object({
  botName: z.string().min(1).max(50),
  botPersona: z.enum(['formal', 'casual']).default('formal'),
  primaryLanguage: z.enum(['pl', 'en', 'uk', 'de']).default('pl'),
})

const EscalationSchema = z.object({
  escalationPhoneOffice: z.string().max(30).optional().nullable(),
  escalationPhoneSecurity: z.string().max(30).optional().nullable(),
  escalationEmail: z.string().email().optional().nullable().or(z.literal('')),
})

const EcommerceIntegrationsSchema = z.object({
  baselinkerToken: z.string().max(200).optional(),    // empty = no change
  wcUrl: z.string().url().max(300).optional().nullable().or(z.literal('')),
  wcConsumerKey: z.string().max(200).optional(),      // empty = no change
  wcConsumerSecret: z.string().max(200).optional(),   // empty = no change
  // Kanały tekstowe
  twilioSmsNumber: z.string().max(30).optional().nullable().or(z.literal('')),
  messengerPageId: z.string().max(50).optional().nullable().or(z.literal('')),
  messengerPageToken: z.string().max(400).optional(),   // secret, empty = no change
  messengerAppSecret: z.string().max(200).optional(),   // secret, empty = no change
})

const IdoBookingCredsSchema = z.object({
  scope: z.string().trim().min(1).max(50).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Kod: małe litery, cyfry i myślniki'),
  tenant: z.string().min(1).max(50),
  systemLogin: z.string().min(1).max(100),
  apiPassword: z.string().max(200).optional(),  // empty = no change
  isActive: z.boolean().default(true),
})

export type ActionResult = {
  ok: boolean
  message?: string
  errors?: Record<string, string>
}

async function getClientIdBySlug(slug: string): Promise<string> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { id: true } })
  if (!c) throw new Error(`Client ${slug} not found`)
  return c.id
}

function parseStr(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

// ─── Brand ────────────────────────────────────────────────────────────────

export async function updateBrand(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = BrandSchema.safeParse({
    botName: fd.get('botName') ?? '',
    botPersona: fd.get('botPersona') ?? 'formal',
    primaryLanguage: fd.get('primaryLanguage') ?? 'pl',
  })
  if (!parsed.success) {
    return { ok: false, message: 'Błędy walidacji' }
  }
  const guard = await assertPermissionOrFail('settings.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  const slug = await activeClientSlug()
  const id = await getClientIdBySlug(slug)
  await prisma.clients.update({
    where: { id },
    data: {
      bot_name: parsed.data.botName,
      bot_persona: parsed.data.botPersona,
      primary_language: parsed.data.primaryLanguage,
    },
  })
  revalidatePath('/settings')
  return { ok: true, message: 'Zapisano' }
}

// ─── Escalation ────────────────────────────────────────────────────────────
// Self-service tenanta (/settings/escalation). Zapisuje do `config.escalation`
// (JSONB, przez backend `/api/admin/set-config`) — TO jest źródło, które bot
// faktycznie czyta (app/bot/prompts/common.py) i które służy jako fallback SMS
// gdy tabela escalation_recipients jest pusta (app/ops/escalation_sms.py).
// Kolumny `clients.escalation_phone_office/_security/escalation_email` są martwe
// (nic ich nie czyta) — zostają w schemacie, ale ten formularz już ich nie rusza.

export async function updateEscalation(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = EscalationSchema.safeParse({
    escalationPhoneOffice: parseStr(fd, 'escalationPhoneOffice'),
    escalationPhoneSecurity: parseStr(fd, 'escalationPhoneSecurity'),
    escalationEmail: parseStr(fd, 'escalationEmail'),
  })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }
  const guard = await assertPermissionOrFail('settings.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  const slug = await activeClientSlug()
  const r = await saveEscalationConfigPatch(slug, {
    phone: parsed.data.escalationPhoneOffice ?? '',
    security_phone: parsed.data.escalationPhoneSecurity ?? '',
    email: parsed.data.escalationEmail ?? '',
  })
  if (!r.ok) return { ok: false, message: r.message }
  revalidatePath('/settings/escalation')
  revalidatePath('/settings')
  return { ok: true, message: 'Zapisano' }
}

// ─── Ecommerce integrations (BaseLinker + WooCommerce → config.integrations) ─
// Backend EtinBOT czyta te klucze z clients.config.integrations JSONB (tool_registry.py).
// Sekrety (token, consumer_key/secret): puste pole = nie zmieniaj (jak dotąd).
// Niesekrety (wc_url, twilio_sms_number, messenger_page_id): puste pole NIE kasuje
// istniejącej wartości — dopiero świadomy checkbox "Wyczyść" (audyt 08.2026: pre-fill
// input może się nie wgrać przy regresji/race, cichy wipe działającej integracji
// jest gorszy niż brak zmiany).

export async function upsertEcommerceIntegrations(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('settings.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = EcommerceIntegrationsSchema.safeParse({
    baselinkerToken: parseStr(fd, 'baselinkerToken') ?? undefined,
    wcUrl: parseStr(fd, 'wcUrl'),
    wcConsumerKey: parseStr(fd, 'wcConsumerKey') ?? undefined,
    wcConsumerSecret: parseStr(fd, 'wcConsumerSecret') ?? undefined,
    twilioSmsNumber: parseStr(fd, 'twilioSmsNumber'),
    messengerPageId: parseStr(fd, 'messengerPageId'),
    messengerPageToken: parseStr(fd, 'messengerPageToken') ?? undefined,
    messengerAppSecret: parseStr(fd, 'messengerAppSecret') ?? undefined,
  })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }

  const slug = await activeClientSlug()

  // Stan przed zapisem — do anty-wipe porównania (puste pole vs istniejąca wartość).
  const clientRow = await prisma.clients.findUnique({ where: { slug }, select: { config: true } })
  if (!clientRow) return { ok: false, message: `Nie znaleziono klienta ${slug}.` }
  const currentIntegrations = coerceObj(coerceObj(clientRow.config).integrations)

  // S3: zapis przez backend /api/admin/set-integration — sekrety szyfrowane at-rest
  // (panel nie dotyka configu sekretów przez Prisma).
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return { ok: false, message: 'Brak BOT_API_URL / BOT_API_KEY w env panelu.' }
  const setIntegration = async (k: string, v: string | null) => {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/set-integration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(v ? { slug, key: k, value: v } : { slug, key: k }),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`${k}: HTTP ${res.status}`)
  }
  // Pole niesekretne + checkbox "Wyczyść": puste+brak-w-DB = no-op (nic nie wołamy);
  // puste+jest-w-DB+bez-checkboxa = no-op (ignorujemy cichy wipe, zostawiamy wartość);
  // puste+jest-w-DB+checkbox = kasujemy; podane = zawsze zapisujemy.
  const applyClearable = async (k: string, incoming: string | null, clearFlag: boolean) => {
    if (incoming) {
      await setIntegration(k, incoming)
      return
    }
    const hasCurrent = typeof currentIntegrations[k] === 'string' && currentIntegrations[k] !== ''
    if (hasCurrent && clearFlag) await setIntegration(k, null)
  }
  try {
    await applyClearable('wc_url', parsed.data.wcUrl ?? null, fd.get('wcUrlClear') === 'on')
    await applyClearable('twilio_sms_number', parsed.data.twilioSmsNumber ?? null, fd.get('twilioSmsNumberClear') === 'on')
    await applyClearable('messenger_page_id', parsed.data.messengerPageId ?? null, fd.get('messengerPageIdClear') === 'on')
    // sekrety — tylko gdy podane (puste pole = bez zmian)
    if (parsed.data.baselinkerToken) await setIntegration('baselinker_token', parsed.data.baselinkerToken)
    if (parsed.data.wcConsumerKey) await setIntegration('wc_consumer_key', parsed.data.wcConsumerKey)
    if (parsed.data.wcConsumerSecret) await setIntegration('wc_consumer_secret', parsed.data.wcConsumerSecret)
    if (parsed.data.messengerPageToken) await setIntegration('messenger_page_token', parsed.data.messengerPageToken)
    if (parsed.data.messengerAppSecret) await setIntegration('messenger_app_secret', parsed.data.messengerAppSecret)
  } catch (e) {
    return { ok: false, message: `Zapis nie powiódł się: ${e instanceof Error ? e.message : e}` }
  }
  revalidatePath('/settings/integrations')
  revalidatePath('/settings')
  return { ok: true, message: 'Zapisano integracje (sekrety zaszyfrowane)' }
}

// ─── IdoBooking credentials (per-scope multi-tenant) ────────────────────────

export async function upsertIdobookingCreds(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('settings.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = IdoBookingCredsSchema.safeParse({
    scope: fd.get('scope'),
    tenant: (fd.get('tenant') as string)?.trim() ?? '',
    systemLogin: (fd.get('systemLogin') as string)?.trim() ?? '',
    apiPassword: (fd.get('apiPassword') as string) ?? '',
    isActive: fd.get('isActive') === 'on' || fd.get('isActive') === 'true',
  })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }
  const data = parsed.data
  const slug = await activeClientSlug()
  const clientId = await getClientIdBySlug(slug)

  // Sprawdź czy istnieje
  const existing = await prisma.idobooking_credentials.findFirst({
    where: { client_id: clientId, scope: data.scope },
    select: { id: true },
  })

  if (existing) {
    // Update — nie nadpisuj password jeśli puste
    const updateData: any = {
      tenant: data.tenant,
      system_login: data.systemLogin,
      is_active: data.isActive,
    }
    if (data.apiPassword && data.apiPassword.length > 0) {
      updateData.api_password = data.apiPassword
    }
    await prisma.idobooking_credentials.update({
      where: { id: existing.id },
      data: updateData,
    })
  } else {
    // Insert — password wymagany
    if (!data.apiPassword) {
      return { ok: false, message: 'Hasło jest wymagane przy pierwszym konfigurowaniu' }
    }
    await prisma.idobooking_credentials.create({
      data: {
        client_id: clientId,
        scope: data.scope,
        tenant: data.tenant,
        system_login: data.systemLogin,
        api_password: data.apiPassword,
        is_active: data.isActive,
      },
    })
  }

  revalidatePath('/settings/integrations')
  return { ok: true, message: `Zapisano ${data.scope}` }
}

export async function deleteIdobookingCreds(scope: string): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('settings.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const slug = await activeClientSlug()
  const clientId = await getClientIdBySlug(slug)

  await prisma.idobooking_credentials.deleteMany({
    where: { client_id: clientId, scope },
  })

  revalidatePath('/settings/integrations')
  return { ok: true, message: 'Usunięto' }
}
