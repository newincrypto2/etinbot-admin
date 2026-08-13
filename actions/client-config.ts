'use server'

import { revalidatePath } from 'next/cache'

import { assertPermissionOrFail } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { coerceObj } from '@/queries/clients'
import { saveEscalationConfigPatch } from '@/lib/escalation-config'

export type ActionResult = { ok: boolean; message: string }

// ─── Backend helper (kopia wzorca z actions/clients.ts) ─────────────────────

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

/** Czyta aktualny config klienta (coerced) — do RMW merge sekcji. */
async function readConfig(slug: string): Promise<Record<string, unknown> | null> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { config: true } })
  if (!c) return null
  return coerceObj(c.config)
}

function s(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

// ─── set-config (top-level klucze: escalation / payment / company) ──────────
// RMW: set-config podmienia CAŁY klucz. Merge'ujemy patch na istniejącą sekcję,
// żeby nie zgubić pól spoza formularza. Puste pole = usunięcie danego klucza.

async function saveTopLevel(
  slug: string,
  key: string,
  patch: Record<string, string>,
  okMsg: string,
  revalidate: string,
): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const cfg = await readConfig(slug)
  if (!cfg) return { ok: false, message: `Nie znaleziono klienta ${slug}.` }
  const section = coerceObj(cfg[key])
  for (const [k, v] of Object.entries(patch)) {
    if (v === '') delete section[k]
    else section[k] = v
  }

  const r = await callBackend('/api/admin/set-config', {
    slug,
    key,
    value_json: JSON.stringify(section),
  })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath(revalidate)
  return { ok: true, message: okMsg }
}

const VOICE_MODES = new Set(['callback', 'transfer'])

export async function updateEscalation(slug: string, fd: FormData): Promise<ActionResult> {
  const email = s(fd, 'email')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Nieprawidłowy adres e-mail.' }
  }
  const voiceMode = s(fd, 'voice_mode') || 'callback'
  if (!VOICE_MODES.has(voiceMode)) {
    return { ok: false, message: 'Nieprawidłowy tryb reakcji na eskalację (voice).' }
  }
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await saveEscalationConfigPatch(slug, { phone: s(fd, 'phone'), email, voice_mode: voiceMode })
  if (!r.ok) return r
  revalidatePath(`/clients/${slug}`)
  return r
}

export async function updatePayment(slug: string, fd: FormData): Promise<ActionResult> {
  return saveTopLevel(
    slug,
    'payment',
    { recipient: s(fd, 'recipient'), account: s(fd, 'account'), title_prefix: s(fd, 'title_prefix') },
    'Zapisano dane płatności.',
    `/clients/${slug}`,
  )
}

export async function updateCompany(slug: string, fd: FormData): Promise<ActionResult> {
  return saveTopLevel(
    slug,
    'company',
    { legal_name: s(fd, 'legal_name'), address: s(fd, 'address'), nip: s(fd, 'nip') },
    'Zapisano dane firmy.',
    `/clients/${slug}`,
  )
}

// ─── set-integration (config.integrations.*: shipping / webchat) ────────────

async function saveIntegration(
  slug: string,
  key: string,
  patch: Record<string, string | number>,
  okMsg: string,
): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const cfg = await readConfig(slug)
  if (!cfg) return { ok: false, message: `Nie znaleziono klienta ${slug}.` }
  const integ = coerceObj(cfg.integrations)
  const section = coerceObj(integ[key])
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v == null) delete section[k]
    else section[k] = v
  }

  const r = await callBackend('/api/admin/set-integration', {
    slug,
    key,
    value_json: JSON.stringify(section),
  })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath(`/clients/${slug}`)
  return { ok: true, message: okMsg }
}

function numField(fd: FormData, key: string): number | '' | null {
  const raw = s(fd, key)
  if (raw === '') return ''
  const n = Number(raw.replace(',', '.'))
  return isNaN(n) ? null : n
}

export async function updateShipping(slug: string, fd: FormData): Promise<ActionResult> {
  const threshold = numField(fd, 'free_shipping_threshold')
  const cutoff = numField(fd, 'cutoff_hour')
  if (threshold === null) return { ok: false, message: 'Próg darmowej dostawy musi być liczbą.' }
  if (cutoff === null) return { ok: false, message: 'Godzina cutoff musi być liczbą.' }
  return saveIntegration(
    slug,
    'shipping',
    { free_shipping_threshold: threshold, cutoff_hour: cutoff },
    'Zapisano ustawienia dostawy.',
  )
}

export async function updateWebchat(slug: string, fd: FormData): Promise<ActionResult> {
  return saveIntegration(
    slug,
    'webchat',
    { name: s(fd, 'name'), greeting: s(fd, 'greeting'), color: s(fd, 'color') },
    'Zapisano ustawienia webchatu.',
  )
}

// ─── Funkcje bota (config.features: ordering / order_lookup) ────────────────
// RMW: czytamy istniejącą sekcję features i nadpisujemy oba flagi (komplet),
// zachowując ewentualne inne klucze features dodane w przyszłości.

export async function updateFeatures(slug: string, fd: FormData): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const cfg = await readConfig(slug)
  if (!cfg) return { ok: false, message: `Nie znaleziono klienta ${slug}.` }
  const section = coerceObj(cfg.features)
  // checkbox: obecny w FormData ('on') = zaznaczony, brak = odznaczony
  section.ordering = fd.get('ordering') === 'on'
  section.order_lookup = fd.get('order_lookup') === 'on'

  const r = await callBackend('/api/admin/set-config', {
    slug,
    key: 'features',
    value_json: JSON.stringify(section),
  })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath(`/clients/${slug}`)
  return { ok: true, message: 'Zapisano funkcje bota.' }
}

// ─── Autonomia dosyłek (config.integrations.autonomy) ───────────────────────
// RMW: merge na istniejącą sekcję — pola spoza formularza (discount_*,
// cancel_enabled) zostają nietknięte. Tokeny generyczne = słownictwo
// produktowe tenanta (zasada SaaS: per klient w configu, nie w kodzie).

export async function updateAutonomy(slug: string, fd: FormData): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const cfg = await readConfig(slug)
  if (!cfg) return { ok: false, message: `Nie znaleziono klienta ${slug}.` }
  const integ = coerceObj(cfg.integrations)
  const section = coerceObj(integ.autonomy)

  section.reship_enabled = fd.get('reship_enabled') === 'on'

  for (const key of ['reship_max_qty', 'reship_window_days', 'reship_max_in_window'] as const) {
    const raw = s(fd, key)
    if (raw === '') {
      delete section[key]
      continue
    }
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, message: `Pole „${key}" musi być liczbą całkowitą ≥ 1.` }
    }
    section[key] = n
  }

  const tokens = s(fd, 'reship_generic_tokens')
    .split(/[,;\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length) section.reship_generic_tokens = tokens
  else delete section.reship_generic_tokens

  const r = await callBackend('/api/admin/set-integration', {
    slug,
    key: 'autonomy',
    value_json: JSON.stringify(section),
  })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath(`/clients/${slug}`)
  return { ok: true, message: 'Zapisano ustawienia autonomii dosyłek.' }
}

// ─── Allegro Device Code Flow (endpointy buduje inny agent) ─────────────────

export type AllegroStart =
  | { ok: true; userCode: string; verificationUri: string; deviceCode: string; intervalSec: number }
  | { ok: false; message: string }

export async function allegroDeviceStart(slug: string): Promise<AllegroStart> {
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/admin/allegro-device-start', { slug })
  if (!r.ok) return { ok: false, message: `Nie udało się rozpocząć (${r.status}). ${r.text.slice(0, 140)}` }
  const d = r.data
  const userCode = (d.user_code as string) ?? ''
  const verificationUri = (d.verification_uri_complete as string) ?? (d.verification_uri as string) ?? ''
  const deviceCode = (d.device_code as string) ?? ''
  if (!userCode || !deviceCode) {
    return { ok: false, message: 'Backend nie zwrócił user_code / device_code.' }
  }
  return {
    ok: true,
    userCode,
    verificationUri,
    deviceCode,
    intervalSec: typeof d.interval === 'number' ? (d.interval as number) : 5,
  }
}

export type AllegroPoll =
  | { ok: true; status: 'pending' | 'connected'; message: string }
  | { ok: false; message: string }

export async function allegroDevicePoll(slug: string, deviceCode: string): Promise<AllegroPoll> {
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/admin/allegro-device-poll', { slug, device_code: deviceCode })
  if (!r.ok) return { ok: false, message: `Błąd sprawdzania (${r.status}). ${r.text.slice(0, 140)}` }
  const status = (r.data.status as string) ?? 'pending'
  if (status === 'connected') {
    revalidatePath(`/clients/${slug}`)
    return { ok: true, status: 'connected', message: 'Połączono z Allegro.' }
  }
  return { ok: true, status: 'pending', message: 'Jeszcze nie potwierdzono — kliknij „Sprawdź" po autoryzacji.' }
}
