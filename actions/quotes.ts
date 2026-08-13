'use server'

import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { assertPermissionOrFail } from '@/lib/permissions'
import { callBackend, callBackendGet } from '@/lib/backend'
import { prisma } from '@/lib/prisma'
import { activeClientSlug } from '@/lib/tenant'
import { coerceObj, num, str, type WfirmaGood } from '@/lib/quotes'

export type QuoteActionResult = { ok: boolean; message: string }

/** Imię i nazwisko zalogowanego użytkownika (approved_by). Wzorzec z actions/email.ts. */
async function currentUserName(): Promise<string | undefined> {
  const session = await auth()
  if (session?.user?.name) return session.user.name
  const email = session?.user?.email
  if (email) {
    const u = await prisma.adminUser.findUnique({ where: { email }, select: { name: true } })
    return u?.name ?? undefined
  }
  return undefined
}

function backendError(r: { status: number; data: Record<string, unknown>; text: string }): string {
  const detail = (r.data?.detail as string) || (r.data?.message as string) || r.text || `HTTP ${r.status}`
  return String(detail).slice(0, 200)
}

// ─── Nowa wycena (ręczna) ────────────────────────────────────────────────────

export type CreateQuoteInput = {
  product: string
  quantity?: number
  personalization?: string
  deadline?: string
  notes?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerCompany?: string
}

export async function createQuote(
  input: CreateQuoteInput,
): Promise<QuoteActionResult & { quoteId?: string }> {
  const guard = await assertPermissionOrFail('quotes.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  if (!input.product.trim()) return { ok: false, message: 'Podaj produkt do wyceny.' }

  const slug = await activeClientSlug()
  const r = await callBackend('/api/admin/quotes/create', {
    slug,
    product: input.product.trim(),
    quantity: input.quantity,
    personalization: input.personalization?.trim() || undefined,
    deadline: input.deadline?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    customer_name: input.customerName?.trim() || undefined,
    customer_email: input.customerEmail?.trim() || undefined,
    customer_phone: input.customerPhone?.trim() || undefined,
    customer_company: input.customerCompany?.trim() || undefined,
    analyze: true,
  })
  if (!r.ok) return { ok: false, message: `Nie udało się utworzyć wyceny: ${backendError(r)}` }
  revalidatePath('/wyceny')
  return {
    ok: true,
    message: 'Wycena utworzona — analiza w toku.',
    quoteId: r.data.quote_id != null ? String(r.data.quote_id) : undefined,
  }
}

// ─── Ponowna analiza LLM ─────────────────────────────────────────────────────

export async function reanalyzeQuote(id: string): Promise<QuoteActionResult> {
  const guard = await assertPermissionOrFail('quotes.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const r = await callBackend(`/api/admin/quotes/${encodeURIComponent(id)}/analyze`, {})
  if (!r.ok) return { ok: false, message: `Nie udało się uruchomić analizy: ${backendError(r)}` }
  revalidatePath(`/wyceny/${id}`)
  revalidatePath('/wyceny')
  return { ok: true, message: 'Analiza uruchomiona — wynik za ok. 10–30 s, odśwież stronę.' }
}

// ─── Zmiana statusu ──────────────────────────────────────────────────────────

export async function setQuoteStatus(id: string, status: string): Promise<QuoteActionResult> {
  const guard = await assertPermissionOrFail('quotes.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const body: Record<string, unknown> = { status }
  if (status === 'approved') body.approved_by = await currentUserName()

  const r = await callBackend(`/api/admin/quotes/${encodeURIComponent(id)}/status`, body)
  if (!r.ok) return { ok: false, message: `Nie udało się zmienić statusu: ${backendError(r)}` }
  revalidatePath(`/wyceny/${id}`)
  revalidatePath('/wyceny')
  const msg =
    status === 'approved' ? 'Wycena zatwierdzona.' : status === 'rejected' ? 'Wycena odrzucona.' : 'Status zmieniony.'
  return { ok: true, message: msg }
}

// ─── Pozycje kalkulacji (podmienia WSZYSTKIE i przelicza) ────────────────────

export type SaveLinesInput = {
  lines: {
    kind: string
    name: string
    qty: number
    unit: string
    unit_cost: number
    cost_item_key?: string
    notes?: string
  }[]
  targetMarginPct?: number
  pricePerUnitOverride?: number
  quantity?: number
}

export type SaveLinesResult = QuoteActionResult & {
  totals?: {
    costTotal: number | null
    pricePerUnit: number | null
    priceTotal: number | null
    marginPct: number | null
  }
}

export async function saveQuoteLines(id: string, input: SaveLinesInput): Promise<SaveLinesResult> {
  const guard = await assertPermissionOrFail('quotes.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const r = await callBackend(`/api/admin/quotes/${encodeURIComponent(id)}/lines`, {
    lines: input.lines,
    target_margin_pct: input.targetMarginPct,
    price_per_unit_override: input.pricePerUnitOverride,
    quantity: input.quantity,
  })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać kalkulacji: ${backendError(r)}` }
  revalidatePath(`/wyceny/${id}`)
  revalidatePath('/wyceny')
  return {
    ok: true,
    message: 'Kalkulacja zapisana i przeliczona.',
    totals: {
      costTotal: num(r.data.cost_total),
      pricePerUnit: num(r.data.price_per_unit),
      priceTotal: num(r.data.price_total),
      marginPct: num(r.data.margin_pct),
    },
  }
}

// ─── Draft e-maila z wyceną ──────────────────────────────────────────────────

export async function createQuoteEmailDraft(
  id: string,
  input: { mailboxAddress: string; toAddress?: string; subject?: string; bodyText?: string },
): Promise<QuoteActionResult & { conversationId?: string }> {
  const guard = await assertPermissionOrFail('quotes.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  if (!input.mailboxAddress.trim()) return { ok: false, message: 'Podaj adres skrzynki nadawczej.' }

  const r = await callBackend(`/api/admin/quotes/${encodeURIComponent(id)}/send-draft`, {
    mailbox_address: input.mailboxAddress.trim(),
    to_address: input.toAddress?.trim() || undefined,
    subject: input.subject?.trim() || undefined,
    body_text: input.bodyText?.trim() || undefined,
  })
  if (!r.ok) return { ok: false, message: `Nie udało się utworzyć draftu: ${backendError(r)}` }
  revalidatePath(`/wyceny/${id}`)
  revalidatePath('/poczta')
  return {
    ok: true,
    message: 'Draft e-maila utworzony — sprawdź i wyślij w Poczcie.',
    conversationId: r.data.conversation_id != null ? String(r.data.conversation_id) : undefined,
  }
}

// ─── Cennik kosztów ──────────────────────────────────────────────────────────

export type CostItemInput = {
  key: string
  label: string
  category: string
  unit: string
  unit_cost: number
  throughput_per_hour?: number
  notes?: string
  active?: boolean
}

export async function upsertCostItems(items: CostItemInput[]): Promise<QuoteActionResult> {
  const guard = await assertPermissionOrFail('quotes.manage')
  if (!guard.ok) return { ok: false, message: guard.message }
  if (items.length === 0) return { ok: false, message: 'Brak pozycji do zapisania.' }
  for (const it of items) {
    if (!it.key || !it.label.trim()) return { ok: false, message: 'Pozycja cennika musi mieć etykietę.' }
  }

  const slug = await activeClientSlug()
  const r = await callBackend('/api/admin/quote-cost-items', { slug, items })
  if (!r.ok) return { ok: false, message: `Nie udało się zapisać cennika: ${backendError(r)}` }
  revalidatePath('/wyceny/cennik')
  return { ok: true, message: items.length === 1 ? 'Pozycja zapisana.' : `Zapisano ${items.length} pozycji.` }
}

export async function seedCostItems(): Promise<QuoteActionResult> {
  const guard = await assertPermissionOrFail('quotes.manage')
  if (!guard.ok) return { ok: false, message: guard.message }

  const slug = await activeClientSlug()
  const r = await callBackend(`/api/admin/quote-cost-items/seed?slug=${encodeURIComponent(slug)}`, {})
  if (!r.ok) return { ok: false, message: `Seed cennika nie powiódł się: ${backendError(r)}` }
  revalidatePath('/wyceny/cennik')
  const inserted = num(r.data.inserted) ?? 0
  return {
    ok: true,
    message: inserted > 0 ? `Dodano ${inserted} domyślnych pozycji.` : 'Cennik już uzupełniony — nic nie dodano.',
  }
}

// ─── Wyszukiwarka cen wFirma ─────────────────────────────────────────────────

export async function searchWfirmaGoods(
  search: string,
): Promise<{ ok: boolean; goods: WfirmaGood[]; message?: string }> {
  const guard = await assertPermissionOrFail('quotes.view')
  if (!guard.ok) return { ok: false, goods: [], message: guard.message }

  const slug = await activeClientSlug()
  const p = new URLSearchParams({ slug, search: search.trim() })
  const r = await callBackendGet(`/api/admin/wfirma-goods?${p.toString()}`)
  if (!r.ok) return { ok: false, goods: [], message: `Błąd wFirma: ${backendError(r)}` }
  if (r.data.ok === false) {
    return { ok: false, goods: [], message: str(r.data.message) ?? 'wFirma nie jest skonfigurowana dla tego tenanta.' }
  }
  const raw = Array.isArray(r.data.goods) ? (r.data.goods as unknown[]) : []
  return {
    ok: true,
    goods: raw.map((g) => {
      const o = coerceObj(g)
      return {
        id: o.id != null ? String(o.id) : '',
        name: str(o.name) ?? '',
        unit: str(o.unit),
        netto: num(o.netto),
        brutto: num(o.brutto),
        vat: o.vat != null ? String(o.vat) : null,
        code: str(o.code),
      }
    }),
  }
}
