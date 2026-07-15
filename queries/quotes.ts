/**
 * Odczyty modułu Wyceny — wszystko z backendu bota (GET /api/admin/quotes*).
 * Server-side only (sekret BOT_API_KEY przez lib/backend.ts).
 */

import { callBackendGet } from '@/lib/backend'
import { activeClientSlug } from '@/lib/tenant'
import {
  coerceCostItem,
  coerceLine,
  coerceObj,
  coerceQuote,
  num,
  str,
  type CostItem,
  type Quote,
  type QuoteLine,
  type QuoteMessage,
} from '@/lib/quotes'

export type QuotesList = {
  quotes: Quote[]
  counts: Record<string, number>
  error: string | null
}

export async function listQuotes(status?: string): Promise<QuotesList> {
  const slug = await activeClientSlug()
  const p = new URLSearchParams({ slug, limit: '100', offset: '0' })
  if (status) p.set('status', status)
  const r = await callBackendGet(`/api/admin/quotes?${p.toString()}`)
  if (!r.ok) {
    const detail = (r.data?.detail as string) || r.text || `HTTP ${r.status}`
    return { quotes: [], counts: {}, error: `Nie udało się pobrać wycen: ${detail.slice(0, 200)}` }
  }
  const rawQuotes = Array.isArray(r.data.quotes) ? (r.data.quotes as unknown[]) : []
  const rawCounts = coerceObj(r.data.counts)
  const counts: Record<string, number> = {}
  for (const [k, v] of Object.entries(rawCounts)) {
    const n = num(v)
    if (n !== null) counts[k] = n
  }
  return {
    quotes: rawQuotes.map((q) => coerceQuote(coerceObj(q))),
    counts,
    error: null,
  }
}

export type QuoteDetail = {
  quote: Quote
  lines: QuoteLine[]
  conversation: QuoteMessage[]
}

export async function getQuote(id: string): Promise<QuoteDetail | null> {
  const r = await callBackendGet(`/api/admin/quotes/${encodeURIComponent(id)}`)
  if (r.status === 404) return null
  if (!r.ok || !r.data.quote) return null
  const rawLines = Array.isArray(r.data.lines) ? (r.data.lines as unknown[]) : []
  const rawConv = Array.isArray(r.data.conversation) ? (r.data.conversation as unknown[]) : []
  return {
    quote: coerceQuote(coerceObj(r.data.quote)),
    lines: rawLines
      .map((l, i) => coerceLine(coerceObj(l), i))
      .sort((a, b) => a.position - b.position),
    conversation: rawConv.map((m) => {
      const o = coerceObj(m)
      return {
        role: str(o.role) ?? 'user',
        content: str(o.content) ?? '',
        createdAt: str(o.created_at),
      }
    }),
  }
}

export async function listCostItems(): Promise<{ items: CostItem[]; error: string | null }> {
  const slug = await activeClientSlug()
  const r = await callBackendGet(`/api/admin/quote-cost-items?slug=${encodeURIComponent(slug)}`)
  if (!r.ok) {
    const detail = (r.data?.detail as string) || r.text || `HTTP ${r.status}`
    return { items: [], error: `Nie udało się pobrać cennika: ${detail.slice(0, 200)}` }
  }
  const raw = Array.isArray(r.data.items) ? (r.data.items as unknown[]) : []
  return { items: raw.map((i) => coerceCostItem(coerceObj(i))), error: null }
}
