/**
 * Moduł Wyceny (B2B) — współdzielone typy, etykiety i formatowanie.
 * Dane pochodzą WYŁĄCZNIE z backendu bota (BOT_API_URL, /api/admin/quotes*),
 * panel nie ma własnych modeli Prisma dla wycen.
 *
 * Plik bez 'use server' — importowalny i w server components, i w client components.
 */

// ─── Typy ────────────────────────────────────────────────────────────────────

export type QuoteStatus = 'new' | 'analyzing' | 'ready' | 'approved' | 'sent' | 'rejected' | 'failed'

export type QuoteSpec = {
  product: string | null
  quantity: number | null
  personalization: string | null
  deadline: string | null
  notes: string | null
}

export type Quote = {
  id: string
  clientId: string | null
  conversationId: string | null
  sourceChannel: string | null
  status: string
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerCompany: string | null
  spec: QuoteSpec
  quantity: number | null
  targetMarginPct: number | null
  costTotal: number | null
  pricePerUnit: number | null
  priceTotal: number | null
  /** 0–1 (ułamek), do wyświetlenia ×100 */
  marginPct: number | null
  analysis: string | null
  error: string | null
  approvedBy: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string | null
}

export type QuoteLine = {
  id: string | null
  position: number
  kind: string
  name: string
  qty: number | null
  unit: string | null
  unitCost: number | null
  totalCost: number | null
  costItemKey: string | null
  notes: string | null
}

export type QuoteMessage = {
  role: string
  content: string
  createdAt: string | null
}

export type CostItem = {
  key: string
  label: string
  category: string
  unit: string | null
  unitCost: number | null
  throughputPerHour: number | null
  notes: string | null
  active: boolean
}

export type WfirmaGood = {
  id: string
  name: string
  unit: string | null
  netto: number | null
  brutto: number | null
  vat: string | null
  code: string | null
}

// ─── Etykiety / kolory ───────────────────────────────────────────────────────

export const QUOTE_STATUSES: QuoteStatus[] = ['new', 'analyzing', 'ready', 'approved', 'sent', 'rejected', 'failed']

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: 'Nowa', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  analyzing: { label: 'W analizie', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ready: { label: 'Gotowa', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Zatwierdzona', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sent: { label: 'Wysłana', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { label: 'Odrzucona', cls: 'bg-red-50 text-red-700 border-red-200' },
  failed: { label: 'Błąd', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export function statusMeta(status: string): { label: string; cls: string } {
  return STATUS_META[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
}

export const CHANNEL_LABEL: Record<string, string> = {
  email: 'E-mail',
  webchat: 'Webchat',
  messenger: 'Messenger',
  allegro: 'Allegro',
  sms: 'SMS',
  voice: 'Telefon',
  manual: 'Ręczna',
}

export function channelLabel(ch: string | null): string {
  if (!ch) return '—'
  return CHANNEL_LABEL[ch] ?? ch
}

/** Rodzaje pozycji kalkulacji (kolumna kind). */
export const LINE_KINDS: { value: string; label: string }[] = [
  { value: 'product', label: 'Produkt' },
  { value: 'material', label: 'Materiał' },
  { value: 'packaging', label: 'Opakowanie' },
  { value: 'labor', label: 'Robocizna' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Inne' },
]

/** Kategorie cennika kosztów. */
export const COST_CATEGORIES: { value: string; label: string }[] = [
  { value: 'material', label: 'Materiały' },
  { value: 'packaging', label: 'Opakowania' },
  { value: 'labor', label: 'Robocizna' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Inne' },
]

export function categoryLabel(cat: string): string {
  return COST_CATEGORIES.find((c) => c.value === cat)?.label ?? cat
}

// ─── Formatowanie ────────────────────────────────────────────────────────────

/** Kwota → "1 234,56 zł" (polska notacja przecinkowa). */
export function fmtZl(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}

/** Marża 0–1 → "34,5%". */
export function fmtMarginPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${(v * 100).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// ─── Koercja danych z backendu (jsonb bywa double-encoded) ──────────────────

export function coerceObj(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

export function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

export function coerceQuote(raw: Record<string, unknown>): Quote {
  const spec = coerceObj(raw.spec)
  return {
    id: String(raw.id ?? ''),
    clientId: str(raw.client_id),
    conversationId: str(raw.conversation_id),
    sourceChannel: str(raw.source_channel),
    status: str(raw.status) ?? 'new',
    customerName: str(raw.customer_name),
    customerEmail: str(raw.customer_email),
    customerPhone: str(raw.customer_phone),
    customerCompany: str(raw.customer_company),
    spec: {
      product: str(spec.product),
      quantity: num(spec.quantity),
      personalization: str(spec.personalization),
      deadline: str(spec.deadline),
      notes: str(spec.notes),
    },
    quantity: num(raw.quantity),
    targetMarginPct: num(raw.target_margin_pct),
    costTotal: num(raw.cost_total),
    pricePerUnit: num(raw.price_per_unit),
    priceTotal: num(raw.price_total),
    marginPct: num(raw.margin_pct),
    analysis: str(raw.analysis),
    error: str(raw.error),
    approvedBy: str(raw.approved_by),
    sentAt: str(raw.sent_at),
    createdAt: str(raw.created_at) ?? new Date().toISOString(),
    updatedAt: str(raw.updated_at),
  }
}

export function coerceLine(raw: Record<string, unknown>, index: number): QuoteLine {
  return {
    id: raw.id != null ? String(raw.id) : null,
    position: num(raw.position) ?? index,
    kind: str(raw.kind) ?? 'other',
    name: str(raw.name) ?? '',
    qty: num(raw.qty),
    unit: str(raw.unit),
    unitCost: num(raw.unit_cost),
    totalCost: num(raw.total_cost),
    costItemKey: str(raw.cost_item_key),
    notes: str(raw.notes),
  }
}

export function coerceCostItem(raw: Record<string, unknown>): CostItem {
  return {
    key: str(raw.key) ?? '',
    label: str(raw.label) ?? '',
    category: str(raw.category) ?? 'other',
    unit: str(raw.unit),
    unitCost: num(raw.unit_cost),
    throughputPerHour: num(raw.throughput_per_hour),
    notes: str(raw.notes),
    active: raw.active !== false,
  }
}

// ─── Pomocnicze ──────────────────────────────────────────────────────────────

const PL_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

/** Slug z etykiety → key pozycji cennika (np. "Wstążka satynowa" → "wstazka-satynowa"). */
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}
