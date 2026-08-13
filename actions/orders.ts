'use server'

import { assertPermissionOrFail } from '@/lib/permissions'
import type { SyncResult } from '@/actions/products'
import { activeClientSlug } from '@/lib/tenant'

/** Ręczne uruchomienie syncu zamówień — woła backend EtinBOT (POST /api/admin/sync-orders). */
export async function triggerOrderSync(): Promise<SyncResult> {
  const guard = await assertPermissionOrFail('orders.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) {
    return { ok: false, message: 'Brak konfiguracji BOT_API_URL / BOT_API_KEY w env panelu.' }
  }
  const slug = await activeClientSlug()

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/sync-orders`, {
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
      return { ok: true, message: 'Sync zamówień już trwa — poczekaj i odśwież.' }
    }
    return { ok: true, message: 'Sync zamówień uruchomiony w tle (chwilę potrwa).' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `Nie udało się połączyć z backendem: ${msg}` }
  }
}
