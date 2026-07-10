'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// ─── Backend helper ─────────────────────────────────────────────────────────

type BackendResult = { ok: boolean; status: number; data: Record<string, unknown>; text: string }

async function callBackend(path: string, body: Record<string, unknown>): Promise<BackendResult> {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) {
    return { ok: false, status: 0, data: {}, text: 'Brak BOT_API_URL / BOT_API_KEY w env panelu.' }
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const text = await res.text().catch(() => '')
    let data: Record<string, unknown> = {}
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      /* ignore */
    }
    return { ok: res.ok, status: res.status, data, text }
  } catch (e) {
    return { ok: false, status: 0, data: {}, text: `Błąd połączenia: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ─── Walidacja slugu (unikalność) ───────────────────────────────────────────

export async function checkSlugAvailable(
  slug: string,
): Promise<{ ok: boolean; available: boolean; message?: string }> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, available: false, message: guard.message }
  const s = (slug || '').trim().toLowerCase()
  if (!/^[a-z0-9-]{2,50}$/.test(s)) {
    return { ok: true, available: false, message: 'Slug: 2-50 znaków, tylko a-z, 0-9 i myślnik.' }
  }
  const existing = await prisma.clients.findUnique({ where: { slug: s }, select: { id: true } })
  return { ok: true, available: !existing, message: existing ? 'Ten slug jest już zajęty.' : 'Slug wolny.' }
}

// ─── Test integracji ────────────────────────────────────────────────────────

export type IntegrationTestResult = { ok: boolean; detail?: string; error?: string }

export async function testIntegration(
  integration: 'woocommerce' | 'baselinker' | 'email' | 'messenger' | 'allegro',
  params: Record<string, unknown>,
  slug?: string,
): Promise<IntegrationTestResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, error: guard.message }
  const body: Record<string, unknown> = { integration, params: params ?? {} }
  if (slug) body.slug = slug
  const r = await callBackend('/api/admin/test-integration', body)
  if (!r.ok && r.status === 0) return { ok: false, error: r.text }
  if (!r.ok) return { ok: false, error: (r.data.error as string) || (r.data.detail as string) || `HTTP ${r.status}` }
  return {
    ok: Boolean(r.data.ok),
    detail: r.data.detail as string | undefined,
    error: r.data.error as string | undefined,
  }
}

// ─── Aktywacja / dezaktywacja ────────────────────────────────────────────────

export async function setClientActive(
  slug: string,
  active: boolean,
): Promise<{ ok: boolean; message: string }> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/admin/set-active', { slug, active })
  if (!r.ok) return { ok: false, message: `Nie udało się zmienić statusu (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath('/clients')
  revalidatePath(`/clients/${slug}`)
  return { ok: true, message: active ? 'Tenant aktywowany.' : 'Tenant zdezaktywowany — kanały nie routują.' }
}

// ─── Sandbox chat ─────────────────────────────────────────────────────────────

export type SandboxMessage = { role: 'user' | 'assistant'; content: string }
export type SandboxToolCall = { name?: string; args?: unknown }
export type SandboxResult =
  | {
      ok: true
      text: string
      tools: SandboxToolCall[]
      escalated: boolean
      escalationReason?: string | null
      latencyMs?: number
      model?: string
      tokensIn?: number
      tokensOut?: number
    }
  | { ok: false; message: string }

export async function sandboxChat(
  slug: string,
  message: string,
  history: SandboxMessage[],
  identity?: { email?: string; phone?: string },
): Promise<SandboxResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }
  if (!message.trim()) return { ok: false, message: 'Wpisz wiadomość.' }
  const r = await callBackend('/api/admin/sandbox-chat', {
    slug,
    message,
    history: history.slice(-30),
    email: identity?.email || undefined,
    phone: identity?.phone || undefined,
  })
  if (!r.ok) return { ok: false, message: `Sandbox błąd (${r.status}). ${r.text.slice(0, 160)}` }
  return {
    ok: true,
    text: (r.data.text as string) ?? '',
    tools: Array.isArray(r.data.tools) ? (r.data.tools as SandboxToolCall[]) : [],
    escalated: Boolean(r.data.escalated),
    escalationReason: (r.data.escalation_reason as string | null) ?? null,
    latencyMs: r.data.latency_ms as number | undefined,
    model: r.data.model as string | undefined,
    tokensIn: r.data.tokens_in as number | undefined,
    tokensOut: r.data.tokens_out as number | undefined,
  }
}

// ─── prompt_extra ─────────────────────────────────────────────────────────────

export async function savePromptExtra(
  slug: string,
  text: string,
): Promise<{ ok: boolean; message: string }> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/admin/set-config', {
    slug,
    key: 'prompt_extra',
    value_json: JSON.stringify(text ?? ''),
  })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath(`/clients/${slug}`)
  return { ok: true, message: 'Zapisano dodatkowe reguły promptu.' }
}

// ─── Wizard: utworzenie tenanta ─────────────────────────────────────────────

const WizardSchema = z.object({
  // Krok 1 — podstawy
  name: z.string().min(2).max(200),
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'Slug: 2-50 znaków a-z, 0-9, myślnik'),
  vertical: z.enum(['ecommerce', 'rental']),
  languages: z.array(z.enum(['pl', 'en', 'uk', 'de'])).min(1),
  primaryLanguage: z.enum(['pl', 'en', 'uk', 'de']),
  officeHours: z.string().max(120).optional().default(''),
  // Krok 2 — brand & bot
  botName: z.string().max(60).optional().default(''),
  personaDesc: z.string().max(1000).optional().default(''),
  greeting: z.string().max(600).optional().default(''),
  companyLegalName: z.string().max(200).optional().default(''),
  companyAddress: z.string().max(200).optional().default(''),
  companyNip: z.string().max(30).optional().default(''),
  escalationPhone: z.string().max(30).optional().default(''),
  escalationEmail: z.string().max(160).optional().default(''),
  // Rental — kontakt eskalacyjny ochrony (config.escalation.security_phone)
  escalationSecurityPhone: z.string().max(30).optional().default(''),
  // Krok 3 — integracje (wszystkie opcjonalne)
  wcUrl: z.string().max(300).optional().default(''),
  wcConsumerKey: z.string().max(200).optional().default(''),
  wcConsumerSecret: z.string().max(200).optional().default(''),
  baselinkerToken: z.string().max(200).optional().default(''),
  twilioSmsNumber: z.string().max(30).optional().default(''),
  messengerPageId: z.string().max(50).optional().default(''),
  messengerPageToken: z.string().max(400).optional().default(''),
  emailAddress: z.string().max(160).optional().default(''),
  emailProvider: z.enum(['gmail', 'imap']).optional().default('imap'),
  emailImapHost: z.string().max(160).optional().default(''),
  emailImapPort: z.string().max(6).optional().default(''),
  emailImapUser: z.string().max(160).optional().default(''),
  emailImapPass: z.string().max(200).optional().default(''),
  emailSmtpHost: z.string().max(160).optional().default(''),
  emailSmtpPort: z.string().max(6).optional().default(''),
  freeShippingThreshold: z.string().max(12).optional().default(''),
  shippingCutoff: z.string().max(40).optional().default(''),
  // Krok 3 — płatności (config.payment, top-level)
  paymentRecipient: z.string().max(200).optional().default(''),
  paymentAccount: z.string().max(60).optional().default(''),
  paymentTitlePrefix: z.string().max(120).optional().default(''),
  // Krok 3 — VAT (config.integrations.vat_classes) — mapa klasa WC → stawka %
  vatClasses: z
    .array(z.object({ name: z.string().max(120), rate: z.string().max(8) }))
    .optional()
    .default([]),
  // Krok 3 — Allegro (config.integrations.allegro) — creds aplikacji (szyfrowane)
  allegroClientId: z.string().max(200).optional().default(''),
  allegroClientSecret: z.string().max(400).optional().default(''),
  // Krok 3 — IdoBooking (rental) — dane dostępowe API (hasło szyfrowane po stronie backendu)
  idoScope: z.string().max(60).optional().default(''),
  idoTenant: z.string().max(120).optional().default(''),
  idoLogin: z.string().max(160).optional().default(''),
  idoPassword: z.string().max(300).optional().default(''),
  // Krok 5 — Wiedza / FAQ (surowy tekst; parsowany server-side)
  faqText: z.string().max(40000).optional().default(''),
  // Krok 4 — kanały
  enabledChannels: z.array(z.string()).default([]),
})

// ── Parser bazy wiedzy / FAQ ────────────────────────────────────────────────
// Akceptuje: pary "pytanie\nodpowiedź" rozdzielone pustą linią; prefiksy
// Q:/A:, P:/O:, Pytanie:/Odpowiedź:. Elastyczny — działa dla obu stylów.
type FaqPair = { question: string; answer: string }

function parseFaq(raw: string): FaqPair[] {
  const text = (raw ?? '').replace(/\r\n?/g, '\n').trim()
  if (!text) return []
  const qre = /^\s*(?:q|p|pytanie|question)\s*[:.)]\s*/i
  const are = /^\s*(?:a|o|odpowied[źz]|answer)\s*[:.)]\s*/i
  const lines = text.split('\n')
  const hasMarkers = lines.some((l) => qre.test(l) || are.test(l))

  if (hasMarkers) {
    type Acc = { q: string[]; a: string[]; mode: 'q' | 'a' }
    const entries: Acc[] = []
    let cur: Acc | null = null
    const flush = () => {
      if (cur && cur.q.length && cur.a.length) entries.push(cur)
    }
    for (const line of lines) {
      if (qre.test(line)) {
        flush()
        cur = { q: [line.replace(qre, '')], a: [], mode: 'q' }
      } else if (are.test(line)) {
        if (!cur) cur = { q: [], a: [], mode: 'a' }
        cur.mode = 'a'
        cur.a.push(line.replace(are, ''))
      } else if (cur) {
        if (cur.mode === 'q') cur.q.push(line)
        else cur.a.push(line)
      }
    }
    flush()
    return entries
      .map((e) => ({ question: e.q.join('\n').trim(), answer: e.a.join('\n').trim() }))
      .filter((e) => e.question && e.answer)
  }

  // Bez markerów: bloki rozdzielone pustą linią, 1. linia = pytanie, reszta = odpowiedź
  return text
    .split(/\n\s*\n+/)
    .map((block) => {
      const bl = block.split('\n')
      const question = (bl[0] ?? '').trim()
      const answer = bl.slice(1).join('\n').trim()
      return { question, answer }
    })
    .filter((e) => e.question && e.answer)
}

export type WizardInput = z.input<typeof WizardSchema>

export type CreateStep = { step: string; ok: boolean; error?: string; info?: string }
export type CreateTenantResult =
  | { ok: true; slug: string; steps: CreateStep[] }
  | { ok: false; message: string; steps?: CreateStep[] }

function clean(v: string | undefined | null): string | undefined {
  const t = (v ?? '').trim()
  return t === '' ? undefined : t
}

export async function createTenant(raw: WizardInput): Promise<CreateTenantResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = WizardSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, message: `Błędy walidacji: ${parsed.error.issues.map((i) => i.message).join('; ')}` }
  }
  const d = parsed.data
  const slug = d.slug.toLowerCase()
  const isRental = d.vertical === 'rental'

  // Unikalność slugu — init-tenant robi UPSERT (nadpisałby istniejący config!)
  const existing = await prisma.clients.findUnique({ where: { slug }, select: { id: true } })
  if (existing) {
    return { ok: false, message: `Slug '${slug}' jest już zajęty — wybierz inny.` }
  }

  const steps: CreateStep[] = []

  // ── config z kroków 1-2 (+ shipping z kroku 3) — BEZ sekretów ──
  const prompt: Record<string, string> = {}
  if (clean(d.botName)) prompt.bot_name = clean(d.botName)!
  const brandShort = clean(d.name)
  if (brandShort) {
    prompt.brand_short = brandShort
    prompt.brand_signature = brandShort
  }

  const integrations: Record<string, unknown> = {}
  // Webchat tylko dla ecommerce (rental używa whatsapp/sms/voice/email).
  if (!isRental && (clean(d.greeting) || clean(d.botName))) {
    integrations.webchat = {
      ...(clean(d.botName) ? { name: clean(d.botName) } : {}),
      ...(clean(d.greeting) ? { greeting: clean(d.greeting) } : {}),
    }
  }
  const shipping: Record<string, unknown> = {}
  if (clean(d.freeShippingThreshold)) {
    const n = Number(clean(d.freeShippingThreshold))
    if (!Number.isNaN(n)) shipping.free_shipping_threshold = n
  }
  if (clean(d.shippingCutoff)) shipping.cutoff = clean(d.shippingCutoff)
  if (Object.keys(shipping).length) integrations.shipping = shipping

  // Escalation — dla rental dokładamy security_phone (ochrona). Wysyłamy komplet
  // w init-tenant (config.escalation z phone/email/security_phone), więc backend
  // ma pełny obiekt od razu — bez osobnego RMW set-config.
  const escalation: Record<string, unknown> = {
    phone: clean(d.escalationPhone) || null,
    email: clean(d.escalationEmail) || null,
  }
  if (isRental && clean(d.escalationSecurityPhone)) {
    escalation.security_phone = clean(d.escalationSecurityPhone)
  }

  const config: Record<string, unknown> = {
    brand_name: clean(d.name),
    primary_language: d.primaryLanguage,
    languages: d.languages,
    office_hours: clean(d.officeHours) || 'pon-pt 9-17',
    escalation,
  }
  if (clean(d.personaDesc)) config.persona = clean(d.personaDesc)
  if (Object.keys(prompt).length) config.prompt = prompt
  if (clean(d.companyLegalName) || clean(d.companyAddress) || clean(d.companyNip)) {
    config.company = {
      ...(clean(d.companyLegalName) ? { legal_name: clean(d.companyLegalName) } : {}),
      ...(clean(d.companyAddress) ? { address: clean(d.companyAddress) } : {}),
      ...(clean(d.companyNip) ? { nip: clean(d.companyNip) } : {}),
    }
  }
  if (Object.keys(integrations).length) config.integrations = integrations

  // ── (a) init-tenant ──
  const initRes = await callBackend('/api/admin/init-tenant', {
    slug,
    name: d.name,
    vertical: d.vertical,
    enabled_channels: d.enabledChannels.length ? d.enabledChannels : (isRental ? ['whatsapp'] : ['webchat']),
    config,
  })
  if (!initRes.ok) {
    steps.push({ step: 'Utworzenie tenanta (init-tenant)', ok: false, error: `HTTP ${initRes.status}. ${initRes.text.slice(0, 160)}` })
    return { ok: false, message: 'Nie udało się utworzyć tenanta — przerwano.', steps }
  }
  steps.push({ step: 'Utworzenie tenanta (init-tenant)', ok: true, info: `action=${initRes.data.action ?? '?'}` })

  // ── (a2) IdoBooking (rental) — dane dostępowe API (fail-safe) ──
  // Poniższe kroki e-commerce (b..d) są guardowane obecnością pól, więc dla
  // rentala (puste WC/BL/email) naturalnie się pomijają.
  if (isRental) {
    const tenant = clean(d.idoTenant)
    const login = clean(d.idoLogin)
    if (tenant && login) {
      const body: Record<string, unknown> = {
        slug,
        scope: clean(d.idoScope) || 'default',
        tenant,
        system_login: login,
      }
      const pass = clean(d.idoPassword)
      if (pass) body.api_password = pass
      const r = await callBackend('/api/admin/idobooking-credentials', body)
      steps.push({ step: 'IdoBooking (dane dostępowe)', ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}. ${r.text.slice(0, 120)}` })
    }
  }

  // ── (b) set-integration — sekrety + nonsekrety (fail-safe per klucz) ──
  const setIntegration = async (label: string, key: string, value: string | undefined) => {
    if (value === undefined) return
    const r = await callBackend('/api/admin/set-integration', { slug, key, value })
    steps.push({ step: `Integracja: ${label}`, ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}. ${r.text.slice(0, 120)}` })
  }
  await setIntegration('WooCommerce URL', 'wc_url', clean(d.wcUrl))
  await setIntegration('WooCommerce consumer key', 'wc_consumer_key', clean(d.wcConsumerKey))
  await setIntegration('WooCommerce consumer secret', 'wc_consumer_secret', clean(d.wcConsumerSecret))
  await setIntegration('BaseLinker token', 'baselinker_token', clean(d.baselinkerToken))
  await setIntegration('Twilio SMS numer', 'twilio_sms_number', clean(d.twilioSmsNumber))
  await setIntegration('Messenger page ID', 'messenger_page_id', clean(d.messengerPageId))
  await setIntegration('Messenger page token', 'messenger_page_token', clean(d.messengerPageToken))

  // ── (b2) Płatności → config.payment (top-level) — tylko gdy coś podano ──
  {
    const rec = clean(d.paymentRecipient)
    const acc = clean(d.paymentAccount)
    const pre = clean(d.paymentTitlePrefix)
    if (rec || acc || pre) {
      const payment: Record<string, unknown> = {}
      if (rec) payment.recipient = rec
      if (acc) payment.account = acc
      if (pre) payment.transfer_title_prefix = pre
      const r = await callBackend('/api/admin/set-config', { slug, key: 'payment', value_json: JSON.stringify(payment) })
      steps.push({ step: 'Dane płatności (przelew)', ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}. ${r.text.slice(0, 120)}` })
    }
  }

  // ── (b3) VAT → config.integrations.vat_classes (mapa klasa→stawka) ──
  {
    const map: Record<string, number> = {}
    for (const row of d.vatClasses ?? []) {
      const name = (row.name ?? '').trim()
      const rateStr = (row.rate ?? '').trim()
      if (rateStr === '') continue
      const rate = Number(rateStr.replace(',', '.'))
      if (Number.isNaN(rate)) continue
      map[name] = rate // name '' = klasa domyślna
    }
    if (Object.keys(map).length) {
      const r = await callBackend('/api/admin/set-integration', { slug, key: 'vat_classes', value_json: JSON.stringify(map) })
      steps.push({ step: 'Klasy VAT', ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}. ${r.text.slice(0, 120)}` })
    }
  }

  // ── (b4) Allegro → config.integrations.allegro (creds aplikacji, szyfrowane) ──
  {
    const cid = clean(d.allegroClientId)
    const csec = clean(d.allegroClientSecret)
    if (cid || csec) {
      const allegro: Record<string, unknown> = {}
      if (cid) allegro.client_id = cid
      if (csec) allegro.client_secret = csec
      const r = await callBackend('/api/admin/set-integration', { slug, key: 'allegro', value_json: JSON.stringify(allegro) })
      steps.push({ step: 'Allegro (klucze aplikacji)', ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}. ${r.text.slice(0, 120)}` })
    }
  }

  // ── (b5) Messenger subscribe — po zapisaniu page_id+token (fail-safe) ──
  if (clean(d.messengerPageId) && clean(d.messengerPageToken)) {
    const r = await callBackend('/api/admin/messenger-subscribe', { slug })
    const results = Array.isArray(r.data.results) ? (r.data.results as Array<Record<string, unknown>>) : []
    const allPagesOk = results.length === 0 || results.every((p) => p.ok === true)
    const ok = r.ok && allPagesOk
    const failMsg = results.find((p) => p.ok !== true)?.error as string | undefined
    steps.push({
      step: 'Messenger: strona zasubskrybowana',
      ok,
      error: ok ? undefined : failMsg || `HTTP ${r.status}. ${r.text.slice(0, 120)}`,
    })
  }

  // ── (b6) Import bazy wiedzy / FAQ (fail-safe) ──
  {
    const faqEntries = parseFaq(d.faqText)
    if (faqEntries.length) {
      const r = await callBackend('/api/admin/import-faq', {
        client_slug: slug,
        entries: faqEntries.map((e) => ({
          category: 'ogólne',
          question: e.question,
          answer: e.answer,
          scope: 'both',
          language: d.primaryLanguage,
        })),
      })
      if (r.ok) {
        const ins = Number(r.data.inserted ?? 0)
        const upd = Number(r.data.updated ?? 0)
        const fail = Number(r.data.failed ?? 0)
        steps.push({
          step: `Baza wiedzy: ${ins + upd} wpisów zaimportowanych`,
          ok: fail === 0,
          info: fail === 0 && upd > 0 ? `${ins} nowych, ${upd} zaktualizowanych` : undefined,
          error: fail > 0 ? `${fail} wpisów nie zaimportowano` : undefined,
        })
      } else {
        steps.push({
          step: `Baza wiedzy: ${faqEntries.length} wpisów`,
          ok: false,
          error: `HTTP ${r.status}. ${r.text.slice(0, 120)}`,
        })
      }
    }
  }

  // ── (c) upsert-mailbox ──
  if (clean(d.emailAddress)) {
    const mailbox: Record<string, unknown> = {
      address: clean(d.emailAddress),
      provider: d.emailProvider,
    }
    if (d.emailProvider === 'imap') {
      if (clean(d.emailImapHost)) mailbox.imap_host = clean(d.emailImapHost)
      if (clean(d.emailImapPort)) mailbox.imap_port = Number(clean(d.emailImapPort))
      if (clean(d.emailImapUser)) mailbox.imap_user = clean(d.emailImapUser)
      if (clean(d.emailImapPass)) mailbox.imap_pass = clean(d.emailImapPass)
      if (clean(d.emailSmtpHost)) mailbox.smtp_host = clean(d.emailSmtpHost)
      if (clean(d.emailSmtpPort)) mailbox.smtp_port = Number(clean(d.emailSmtpPort))
    }
    const r = await callBackend('/api/admin/upsert-mailbox', { slug, mailbox })
    steps.push({ step: `Skrzynka e-mail: ${clean(d.emailAddress)}`, ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}. ${r.text.slice(0, 120)}` })
  }

  // ── (d) sync produktów + zamówień (jeśli WC/BL) ──
  if (clean(d.wcUrl) && clean(d.wcConsumerKey) && clean(d.wcConsumerSecret)) {
    const r = await callBackend('/api/admin/sync-products', { slug })
    steps.push({ step: 'Sync produktów (WooCommerce)', ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}`, info: r.ok ? 'uruchomiony w tle' : undefined })
  }
  if (clean(d.baselinkerToken)) {
    const r = await callBackend('/api/admin/sync-orders', { slug })
    steps.push({ step: 'Sync zamówień (BaseLinker)', ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}`, info: r.ok ? 'uruchomiony w tle' : undefined })
  }

  revalidatePath('/clients')
  return { ok: true, slug, steps }
}

// ─── Allegro OAuth device flow (ekran wynikowy) ─────────────────────────────
// Endpointy backendu budowane równolegle — mapowanie pól defensywne.

export type AllegroStartResult =
  | { ok: true; userCode: string; verificationUri: string; deviceCode: string; interval?: number; expiresIn?: number }
  | { ok: false; message: string }

export async function allegroDeviceStart(slug: string): Promise<AllegroStartResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/admin/allegro-device-start', { slug })
  if (!r.ok) {
    return { ok: false, message: `Nie udało się rozpocząć autoryzacji (${r.status}). ${(r.data.detail as string) || r.text.slice(0, 160)}` }
  }
  const d = r.data
  const userCode = (d.user_code as string) || ''
  const verificationUri = (d.verification_uri_complete as string) || (d.verification_uri as string) || ''
  const deviceCode = (d.device_code as string) || ''
  if (!userCode || !deviceCode) {
    return { ok: false, message: 'Backend nie zwrócił user_code / device_code.' }
  }
  return {
    ok: true,
    userCode,
    verificationUri,
    deviceCode,
    interval: typeof d.interval === 'number' ? d.interval : undefined,
    expiresIn: typeof d.expires_in === 'number' ? d.expires_in : undefined,
  }
}

export type AllegroPollResult = { ok: boolean; status: 'connected' | 'pending' | 'error'; message?: string }

export async function allegroDevicePoll(slug: string, deviceCode: string): Promise<AllegroPollResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, status: 'error', message: guard.message }
  if (!deviceCode) return { ok: false, status: 'error', message: 'Brak device_code — rozpocznij autoryzację ponownie.' }
  const r = await callBackend('/api/admin/allegro-device-poll', { slug, device_code: deviceCode })
  const st = (r.data.status as string) || ''
  const connected = r.data.connected === true || st === 'connected'
  const pending = st === 'pending' || st === 'authorization_pending' || r.status === 428
  if (connected) {
    revalidatePath(`/clients/${slug}`)
    return { ok: true, status: 'connected' }
  }
  if (pending) return { ok: true, status: 'pending' }
  if (!r.ok) {
    return { ok: false, status: 'error', message: `Błąd autoryzacji (${r.status}). ${(r.data.detail as string) || r.text.slice(0, 160)}` }
  }
  // ok=true, brak jednoznacznego statusu → traktuj jak pending
  return { ok: true, status: 'pending' }
}
