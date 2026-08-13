import { prisma } from '@/lib/prisma'
import { coerceObj } from '@/queries/clients'

// ─── Backend helper (kopia wzorca z actions/client-config.ts / actions/clients.ts) ─

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

/**
 * RMW zapis PATCHa na `config.escalation` (top-level klucz JSONB `clients.config`,
 * przez backend `/api/admin/set-config`). WSPÓLNA logika dla dwóch miejsc edycji:
 *  - `actions/client-config.ts::updateEscalation` — SUPERADMIN, karta klienta
 *    (/clients/[id]), guard `clients.manage`, edytuje phone/email/voice_mode.
 *  - `actions/client.ts::updateEscalation` — self-service tenanta
 *    (/settings/escalation), guard `settings.manage`, edytuje phone/security_phone/email.
 *
 * Merge na istniejącą sekcję configu — pola spoza patcha (np. voice_mode gdy
 * edytujemy tylko telefony, albo phone/email gdy edytujemy tylko security_phone)
 * zostają nietknięte. Permission guard i revalidatePath robi WOŁAJĄCY (różne
 * uprawnienia i różne ścieżki per kontekst).
 *
 * To jest JEDYNE miejsce, które bot faktycznie czyta (app/bot/prompts/common.py
 * ::_placeholders_from_config: escalation.phone/security_phone/email) — kolumny
 * `clients.escalation_phone_office/_security/escalation_email` są martwe (audyt 08.2026).
 */
export async function saveEscalationConfigPatch(
  slug: string,
  patch: Record<string, string>, // '' = usuń dany klucz z sekcji
): Promise<{ ok: boolean; message: string }> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { config: true } })
  if (!c) return { ok: false, message: `Nie znaleziono klienta ${slug}.` }
  const cfg = coerceObj(c.config)
  const section = coerceObj(cfg.escalation)
  for (const [k, v] of Object.entries(patch)) {
    if (v === '') delete section[k]
    else section[k] = v
  }
  const r = await callBackend('/api/admin/set-config', {
    slug,
    key: 'escalation',
    value_json: JSON.stringify(section),
  })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać (${r.status}). ${r.text.slice(0, 140)}` }
  return { ok: true, message: 'Zapisano dane eskalacji.' }
}
