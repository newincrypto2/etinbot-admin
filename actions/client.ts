'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { activeClientSlug } from '@/lib/tenant'

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

const IntegrationsSchema = z.object({
  idobookingTenant: z.string().max(50).optional().nullable(),
  idobookingLogin: z.string().max(100).optional().nullable(),
  idobookingApiKey: z.string().optional().nullable(),    // empty = no change
  elevenlabsAgentId: z.string().max(100).optional().nullable(),
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
  const guard = await assertRoleOrFail('OWNER')
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
  const guard = await assertRoleOrFail('OWNER')
  if (!guard.ok) return { ok: false, message: guard.message }
  const slug = await activeClientSlug()
  const id = await getClientIdBySlug(slug)
  await prisma.clients.update({
    where: { id },
    data: {
      escalation_phone_office: parsed.data.escalationPhoneOffice,
      escalation_phone_security: parsed.data.escalationPhoneSecurity,
      escalation_email: parsed.data.escalationEmail === '' ? null : parsed.data.escalationEmail,
    },
  })
  revalidatePath('/settings')
  return { ok: true, message: 'Zapisano' }
}

// ─── Integrations ──────────────────────────────────────────────────────────

export async function updateIntegrations(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = IntegrationsSchema.safeParse({
    idobookingTenant: parseStr(fd, 'idobookingTenant'),
    idobookingLogin: parseStr(fd, 'idobookingLogin'),
    idobookingApiKey: parseStr(fd, 'idobookingApiKey'),
    elevenlabsAgentId: parseStr(fd, 'elevenlabsAgentId'),
  })
  if (!parsed.success) {
    return { ok: false, message: 'Błędy walidacji' }
  }
  const guard = await assertRoleOrFail('OWNER')
  if (!guard.ok) return { ok: false, message: guard.message }

  const slug = await activeClientSlug()
  const id = await getClientIdBySlug(slug)

  // TODO Sprint 2: szyfrowanie API key (pgcrypto AES-256). Na razie plaintext.
  const updateData: any = {
    idobooking_tenant: parsed.data.idobookingTenant,
    idobooking_login: parsed.data.idobookingLogin,
    elevenlabs_agent_id: parsed.data.elevenlabsAgentId,
  }
  // Klucz API: jeśli pusty → nie zmieniamy. Jeśli wpisany → zapisujemy.
  if (parsed.data.idobookingApiKey) {
    updateData.idobooking_api_key_enc = parsed.data.idobookingApiKey
  }

  await prisma.clients.update({ where: { id }, data: updateData })
  revalidatePath('/settings')
  return { ok: true, message: 'Zapisano' }
}

// ─── Ecommerce integrations (BaseLinker + WooCommerce → config.integrations) ─
// Backend EtinBOT czyta te klucze z clients.config.integrations JSONB (tool_registry.py).
// Sekrety (token, consumer_key/secret): puste pole = nie zmieniaj. wc_url można wyczyścić.

export async function upsertEcommerceIntegrations(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = await assertRoleOrFail('OWNER')
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
  try {
    // niesekrety — można czyścić (brak value = usunięcie klucza)
    await setIntegration('wc_url', parsed.data.wcUrl || null)
    await setIntegration('twilio_sms_number', parsed.data.twilioSmsNumber || null)
    await setIntegration('messenger_page_id', parsed.data.messengerPageId || null)
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
  const guard = await assertRoleOrFail('OWNER')
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
  const guard = await assertRoleOrFail('OWNER')
  if (!guard.ok) return { ok: false, message: guard.message }

  const slug = await activeClientSlug()
  const clientId = await getClientIdBySlug(slug)

  await prisma.idobooking_credentials.deleteMany({
    where: { client_id: clientId, scope },
  })

  revalidatePath('/settings/integrations')
  return { ok: true, message: 'Usunięto' }
}
