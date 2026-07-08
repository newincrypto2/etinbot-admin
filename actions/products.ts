'use server'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { activeClientSlug } from '@/lib/tenant'

export type SyncResult = { ok: boolean; message: string }

/** Ręczne uruchomienie syncu produktów — woła backend EtinBOT (POST /api/admin/sync-products).
 *  Sync leci w tle po stronie backendu; tu tylko go odpalamy. */
export async function triggerProductSync(): Promise<SyncResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) {
    return { ok: false, message: 'Brak konfiguracji BOT_API_URL / BOT_API_KEY w env panelu.' }
  }
  const slug = await activeClientSlug()

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/sync-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ slug }),
      cache: 'no-store',
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { ok: false, message: `Backend zwrócił ${res.status}. ${txt.slice(0, 120)}` }
    }
    const data = (await res.json().catch(() => ({}))) as { status?: string }
    if (data.status === 'already_running') {
      return { ok: true, message: 'Sync już trwa — poczekaj i odśwież.' }
    }
    return { ok: true, message: 'Sync uruchomiony w tle (może potrwać kilka minut przy pełnym katalogu).' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `Nie udało się połączyć z backendem: ${msg}` }
  }
}
