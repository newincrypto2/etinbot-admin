// lib/order-links.ts — jedno źródło prawdy dla linków do zamówienia w SYSTEMIE
// ŹRÓDŁOWYM (integration-aware, multi-tenant). Skąd wiemy dokąd linkować:
// orders_cache.source (migracja backendu 039): 'baselinker' (default, stare wiersze
// mają NULL = BL) albo 'woocommerce' (sync przez WC REST, app/orders/wc_sync.py).
//
// Które pole ID (z kodu backendu):
// - BaseLinker: ext_id = wewnętrzne order_id BaseLinkera (app/orders/sync.py: _upsert_order
//   → ext_id = order.order_id) — to NIM operuje URL panelu orders.php#order:{id}.
//   shop_order_id = numer w sklepie, który zna klient (NIE działa w URL panelu BL).
// - WooCommerce: ext_id = ID posta zamówienia WC (wc_sync.py: map_wc_order → ext_id =
//   order.id) — to ono idzie do wp-admin ...&action=edit&id={id}. shop_order_id = number.
//
// TODO rental (po migracji silverbota): rezerwacja → IdoBooking,
// pokój/biuro → systemobsluginajmu.pl — jeden wpis w ADMIN_URL_BUILDERS.

import { prisma } from '@/lib/prisma'

export type OrderSource = 'baselinker' | 'woocommerce'

/** Normalizacja source z DB: NULL/'' = stare wiersze sprzed migracji 039 → BaseLinker.
 *  Akceptujemy też skrót 'wc'. Nieznane źródło → null (numer bez linku). */
export function normalizeOrderSource(raw: string | null | undefined): OrderSource | null {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s || s === 'baselinker') return 'baselinker'
  if (s === 'woocommerce' || s === 'wc') return 'woocommerce'
  return null
}

// Dodanie kolejnego systemu sklepowego = jeden wpis w tej mapie.
const ADMIN_URL_BUILDERS: Record<
  OrderSource,
  (ctx: { extId: string; wcUrl: string | null }) => string | null
> = {
  baselinker: ({ extId }) =>
    `https://panel.baselinker.com/orders.php#order:${encodeURIComponent(extId)}`,
  woocommerce: ({ extId, wcUrl }) =>
    wcUrl
      ? `${wcUrl.replace(/\/+$/, '')}/wp-admin/admin.php?page=wc-orders&action=edit&id=${encodeURIComponent(extId)}`
      : null,
}

/** Link do zamówienia w systemie źródłowym (panel BL / wp-admin WC).
 *  Czysta funkcja — wcUrl podaje caller (dla source=woocommerce; patrz wcUrlForClient). */
export function orderAdminUrl(opts: {
  source?: string | null
  extId?: string | null
  wcUrl?: string | null
}): string | null {
  const src = normalizeOrderSource(opts.source)
  const extId = (opts.extId ?? '').trim()
  if (!src || !extId) return null
  return ADMIN_URL_BUILDERS[src]({ extId, wcUrl: opts.wcUrl ?? null })
}

/** Baza URL sklepu WooCommerce tenanta z clients.config.integrations.wc_url
 *  (to samo źródło co getEcommerceIntegrations, ale po client_id — konwersacje
 *  i poczta znają id, nie slug). Zwraca null gdy brak konfiguracji WC. */
export async function wcUrlForClient(clientId: string): Promise<string | null> {
  const c = await prisma.clients.findUnique({ where: { id: clientId }, select: { config: true } })
  if (!c) return null
  // config (jsonb) bywa stringiem przez driver adapter — coerce jak w queries/client.ts
  const coerceObj = (v: unknown): Record<string, unknown> => {
    if (typeof v === 'string') {
      try {
        return JSON.parse(v) as Record<string, unknown>
      } catch {
        return {}
      }
    }
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  }
  const integ = coerceObj(coerceObj(c.config).integrations)
  const url = integ.wc_url
  return typeof url === 'string' && url ? url : null
}
