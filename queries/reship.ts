import { prisma } from '@/lib/prisma'
import { activeClientId } from '@/lib/tenant'

// ─── Coerce items (migration 026: items_text TEXT, ale rekordy mogą trzymać JSON) ─

export type ReshipItem = { label: string; qty: number | null }

/**
 * items_text jest TEXT (np. "3x serce transparentne"). Część botów zapisuje tam
 * JSON (lista pozycji) — próbujemy sparsować i jak się uda, ładnie rozbić; inaczej
 * pokazujemy surowy tekst jako jedną pozycję.
 */
export function coerceItems(raw: string | null): ReshipItem[] {
  const t = (raw ?? '').trim()
  if (!t) return []
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const p = JSON.parse(t)
      const arr = Array.isArray(p) ? p : [p]
      const out: ReshipItem[] = []
      for (const it of arr) {
        if (typeof it === 'string') {
          if (it.trim()) out.push({ label: it.trim(), qty: null })
        } else if (it && typeof it === 'object') {
          const o = it as Record<string, unknown>
          const label = o.name ?? o.label ?? o.title ?? o.product ?? ''
          const qtyRaw = o.qty ?? o.quantity ?? o.count
          const qty = qtyRaw != null && !isNaN(Number(qtyRaw)) ? Number(qtyRaw) : null
          if (String(label).trim()) out.push({ label: String(label).trim(), qty })
        }
      }
      if (out.length) return out
    } catch {
      /* fall through — surowy tekst */
    }
  }
  return [{ label: t, qty: null }]
}

export type ReshipRow = {
  id: string
  orderNumber: string | null
  extId: string | null
  customerEmail: string | null
  customerPhone: string | null
  items: ReshipItem[]
  reason: string | null
  status: string
  createdAt: Date
}

/** Lista dosyłek aktywnego tenanta, najnowsze pierwsze, limit 100. */
export async function listReshipRequests(): Promise<ReshipRow[]> {
  const clientId = await activeClientId()
  const rows = await prisma.reship_requests.findMany({
    where: { client_id: clientId },
    orderBy: { created_at: 'desc' },
    take: 100,
    select: {
      id: true,
      order_number: true,
      ext_id: true,
      customer_email: true,
      customer_phone: true,
      items_text: true,
      reason: true,
      status: true,
      created_at: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    extId: r.ext_id,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    items: coerceItems(r.items_text),
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  }))
}
