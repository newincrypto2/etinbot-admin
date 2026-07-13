import { prisma } from '@/lib/prisma'
import { activeClientSlug } from '@/lib/tenant'
import { orderAdminUrl, normalizeOrderSource, wcUrlForClient } from '@/lib/order-links'
import { courierTrackingUrl } from '@/lib/tracking'

async function clientIdFromSlug(slug?: string): Promise<string> {
  // FAIL-CLOSED: brak/nieznany slug NIE może zdjąć filtra tenanta — wcześniej
  // zwracaliśmy null i listy pokazywały dane WSZYSTKICH tenantów (współdzielona DB).
  if (!slug) throw new Error('Brak (await activeClientSlug()) — panel wymaga przypisanego tenanta')
  const c = await prisma.clients.findUnique({ where: { slug }, select: { id: true } })
  if (!c) throw new Error(`Nieznany tenant '${slug}' — sprawdź env (await activeClientSlug())`)
  return c.id
}

export type EmailThreadRow = {
  id: string
  status: string
  channel: string
  guestEmail: string | null
  guestName: string | null
  inboxAddress: string | null
  subject: string | null
  lastMessageAt: Date
  draftId: string | null
  draftStatus: string | null
  draftOrigin: string | null
  draftEscalated: boolean
  tags: string[]
}

const VIEW_STATUSES: Record<string, string[] | null> = {
  inbox: ['open', 'escalated'], // domyślnie: do obsłużenia
  open: ['open'],
  escalated: ['escalated'],
  closed: ['closed'],
  all: null,
}

/** Lista wątków mailowych z filtrem/wyszukiwarką/paginacją. */
export async function listEmailThreads(opts: {
  clientSlug?: string
  view?: string // 'inbox' (domyślny) | 'open' | 'escalated' | 'closed' | 'all'
  search?: string
  page?: number
  pageSize?: number
}): Promise<{ items: EmailThreadRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(100, opts.pageSize ?? 25)
  const clientId = await clientIdFromSlug(opts.clientSlug)

  const where: Record<string, unknown> = { channel: { in: ['email', 'allegro', 'allegro_issue'] } }
  if (clientId) where.client_id = clientId
  if (opts.view === 'b2b') {
    where.tags = { has: 'b2b' }
  } else {
    const statuses = VIEW_STATUSES[opts.view ?? 'inbox']
    if (statuses) where.status = { in: statuses }
  }

  if (opts.search?.trim()) {
    const s = opts.search.trim()
    // dopasowanie po temacie (email_inbound) → zbiór conversation_id
    const subjMatches = await prisma.email_inbound.findMany({
      where: {
        ...(clientId ? { client_id: clientId } : {}),
        subject: { contains: s, mode: 'insensitive' },
      },
      select: { conversation_id: true },
      take: 500,
    })
    const convIds = subjMatches.map((m) => m.conversation_id).filter((x): x is string => !!x)
    where.OR = [
      { guest_email: { contains: s, mode: 'insensitive' } },
      { guest_name: { contains: s, mode: 'insensitive' } },
      ...(convIds.length ? [{ id: { in: convIds } }] : []),
    ]
  }

  const [total, convs] = await Promise.all([
    prisma.conversations.count({ where }),
    prisma.conversations.findMany({
      where,
      orderBy: { last_message_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        channel: true,
        guest_email: true,
        guest_name: true,
        inbox_address: true,
        last_message_at: true,
        tags: true,
      },
    }),
  ])

  const ids = convs.map((c) => c.id)
  const items: EmailThreadRow[] = []
  if (ids.length) {
    const [drafts, inbound] = await Promise.all([
      prisma.email_drafts.findMany({
        where: { conversation_id: { in: ids } },
        orderBy: { created_at: 'desc' },
        select: { id: true, conversation_id: true, status: true, origin: true, escalated: true, subject: true },
      }),
      prisma.email_inbound.findMany({
        where: { conversation_id: { in: ids } },
        orderBy: { received_at: 'desc' },
        select: { conversation_id: true, subject: true },
      }),
    ])
    const lastDraft = new Map<string, (typeof drafts)[number]>()
    for (const d of drafts) if (!lastDraft.has(d.conversation_id)) lastDraft.set(d.conversation_id, d)
    const lastSubject = new Map<string, string | null>()
    for (const i of inbound)
      if (i.conversation_id && !lastSubject.has(i.conversation_id))
        lastSubject.set(i.conversation_id, i.subject)

    for (const c of convs) {
      const d = lastDraft.get(c.id)
      items.push({
        id: c.id,
        status: c.status,
        channel: c.channel,
        guestEmail: c.guest_email,
        guestName: c.guest_name,
        inboxAddress: c.inbox_address,
        subject: lastSubject.get(c.id) ?? lastDraft.get(c.id)?.subject ?? null,
        lastMessageAt: c.last_message_at,
        draftId: d?.id ?? null,
        draftStatus: d?.status ?? null,
        draftOrigin: d?.origin ?? null,
        draftEscalated: d?.escalated ?? false,
        tags: c.tags ?? [],
      })
    }
  }
  return { items, total, page, pageSize }
}

export type EmailAttachment = {
  inboundId?: string
  attId?: string | null
  id?: string // outbound attachment id
  filename: string
  mimeType: string
  size: number
  downloadable: boolean
}

export type CustomerOrder = {
  extId: string
  shopOrderId: string | null
  status: string | null
  total: number | null
  currency: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  deliveryMethod: string | null
  paymentMethod: string | null
  dateAdd: Date | null
  itemCount: number | null
  /** link do zamówienia w systemie źródłowym (BaseLinker / wp-admin WC) — lib/order-links */
  adminUrl: string | null
  /** link śledzenia przesyłki: tracking_url z DB > mapa kurierów (lib/tracking) */
  trackingHref: string | null
}

export type ShipmentStatus = {
  status: string
  kind: string
  statusDate: string | null
  trackingUrl: string | null
  courier: string | null
}

export type EmailThreadDetail = {
  id: string
  clientId: string
  clientSlug: string
  status: string
  guestEmail: string | null
  guestName: string | null
  inboxAddress: string | null
  tags: string[]
  meta: Record<string, unknown> | null
  messages: { role: string; content: string; createdAt: Date }[]
  // załączniki per wiadomość przychodząca (kolejność = kolejność wiadomości user)
  inbounds: { id: string; receivedAt: Date; attachments: EmailAttachment[] }[]
  drafts: {
    id: string
    subject: string
    bodyText: string | null
    status: string
    origin: string
    escalated: boolean
    toAddress: string
    mailboxAddress: string
    createdAt: Date
    sentAt: Date | null
    attachments: EmailAttachment[]
  }[]
}

export async function getEmailThread(id: string): Promise<EmailThreadDetail | null> {
  // Scope po tenancie panelu — bez tego znajomość UUID wystarczała do odczytu
  // wątku INNEGO tenanta (współdzielona DB, np. KH + Silver Place).
  const { panelClientId } = await import('@/lib/tenant')
  const conv = await prisma.conversations.findFirst({
    where: { id, client_id: await panelClientId(), channel: { in: ['email', 'allegro', 'allegro_issue'] } },
    select: {
      id: true,
      client_id: true,
      status: true,
      guest_email: true,
      guest_name: true,
      inbox_address: true,
      tags: true,
      meta: true,
    },
  })
  if (!conv) return null

  const cl = await prisma.clients.findUnique({
    where: { id: conv.client_id },
    select: { slug: true },
  })

  const [messages, drafts, inboundRows] = await Promise.all([
    prisma.messages.findMany({
      where: { conversation_id: id },
      orderBy: { created_at: 'asc' },
      select: { role: true, content: true, created_at: true },
    }),
    prisma.email_drafts.findMany({ where: { conversation_id: id }, orderBy: { created_at: 'asc' } }),
    prisma.email_inbound.findMany({
      where: { conversation_id: id },
      orderBy: { received_at: 'asc' },
      select: { id: true, attachments: true, received_at: true },
    }),
  ])

  const inbounds = inboundRows.map((r) => ({
    id: r.id,
    receivedAt: r.received_at,
    attachments: coerceArr(r.attachments).map((a) => ({
      inboundId: r.id,
      attId: (a.att_id as string) ?? null,
      filename: (a.filename as string) ?? 'załącznik',
      mimeType: (a.mime_type as string) ?? 'application/octet-stream',
      size: (a.size as number) ?? 0,
      downloadable: !!a.att_id,
    })),
  }))

  const draftIds = drafts.map((d) => d.id)
  const outAtt = draftIds.length
    ? await prisma.email_outbound_attachments.findMany({
        where: { draft_id: { in: draftIds } },
        select: { id: true, draft_id: true, filename: true, mime_type: true, size: true },
      })
    : []
  const attByDraft = new Map<string, EmailAttachment[]>()
  for (const a of outAtt) {
    const arr = attByDraft.get(a.draft_id) ?? []
    arr.push({ id: a.id, filename: a.filename, mimeType: a.mime_type, size: a.size, downloadable: true })
    attByDraft.set(a.draft_id, arr)
  }

  return {
    id: conv.id,
    clientId: conv.client_id,
    clientSlug: cl?.slug ?? '',
    status: conv.status,
    guestEmail: conv.guest_email,
    guestName: conv.guest_name,
    inboxAddress: conv.inbox_address,
    tags: conv.tags ?? [],
    meta: coerceObj(conv.meta) as Record<string, unknown> | null,
    messages: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.created_at })),
    inbounds,
    drafts: drafts.map((d) => ({
      id: d.id,
      subject: d.subject,
      bodyText: d.body_text,
      status: d.status,
      origin: d.origin,
      escalated: d.escalated,
      toAddress: d.to_address,
      mailboxAddress: d.mailbox_address,
      createdAt: d.created_at,
      sentAt: d.sent_at,
      attachments: attByDraft.get(d.id) ?? [],
    })),
  }
}

/** Live status przesyłki z backendu (BaseLinker) dla pojedynczego zamówienia.
 * caller_email = adres klienta z wątku → przechodzi weryfikację tożsamości (anty-IDOR). */
export async function getShipmentStatus(
  slug: string,
  orderNumber: string,
  guestEmail: string | null,
): Promise<ShipmentStatus | null> {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key || !orderNumber) return null
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/tools/check_shipment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        order_id: orderNumber,
        client_slug: slug,
        caller_email: guestEmail ?? undefined,
      }),
    })
    if (!res.ok) return null
    const d = await res.json()
    const p = Array.isArray(d?.packages) ? d.packages[0] : null
    if (!d?.has_shipment || !p) return null
    return {
      status: p.status ?? '',
      kind: p.status_kind ?? 'unknown',
      statusDate: p.status_date ?? null,
      trackingUrl: p.tracking_url ?? null,
      courier: p.courier ?? null,
    }
  } catch {
    return null
  }
}

/** Zamówienia klienta z orders_cache (sidebar w wątku). */
export async function getCustomerOrders(clientId: string, email: string | null): Promise<CustomerOrder[]> {
  if (!email) return []
  const rows = await prisma.orders_cache.findMany({
    where: { client_id: clientId, customer_email: { equals: email, mode: 'insensitive' } },
    orderBy: { date_add: 'desc' },
    take: 10,
    select: {
      ext_id: true,
      shop_order_id: true,
      status: true,
      total_pln: true,
      currency: true,
      tracking_number: true,
      tracking_url: true,
      delivery_method: true,
      payment_method: true,
      source: true,
      date_add: true,
      items: true,
    },
  })
  // wcUrl dociągamy RAZ i tylko gdy któryś wiersz jest z WooCommerce
  const needsWc = rows.some((r) => normalizeOrderSource(r.source) === 'woocommerce')
  const wcUrl = needsWc ? await wcUrlForClient(clientId) : null
  return rows.map((r) => ({
    extId: r.ext_id,
    shopOrderId: r.shop_order_id,
    status: r.status,
    total: r.total_pln ? Number(r.total_pln) : null,
    currency: r.currency,
    trackingNumber: r.tracking_number,
    trackingUrl: r.tracking_url,
    deliveryMethod: r.delivery_method,
    paymentMethod: r.payment_method,
    dateAdd: r.date_add,
    itemCount: coerceArr(r.items).length || null, // jsonb bywa stringiem (driver adapter)
    adminUrl: orderAdminUrl({ source: r.source, extId: r.ext_id, wcUrl }),
    trackingHref: r.tracking_number
      ? r.tracking_url ?? courierTrackingUrl(r.delivery_method, r.tracking_number)
      : null,
  }))
}

export async function getEmailStats(clientSlug?: string) {
  const clientId = await clientIdFromSlug(clientSlug)
  const base: Record<string, unknown> = { channel: { in: ['email', 'allegro', 'allegro_issue'] } }
  if (clientId) base.client_id = clientId
  const [open, escalated, b2b] = await Promise.all([
    prisma.conversations.count({ where: { ...base, status: 'open' } }),
    prisma.conversations.count({ where: { ...base, status: 'escalated' } }),
    prisma.conversations.count({ where: { ...base, tags: { has: 'b2b' } } }),
  ])
  return { open, escalated, b2b, inbox: open + escalated }
}

export type FaqCandidate = {
  id: string
  conversationId: string | null
  source: string
  customerQuestion: string | null
  humanAnswer: string | null
  suggestedQuestion: string | null
  suggestedAnswer: string | null
  suggestedCategory: string | null
  distilled: boolean
  skipReason: string | null
  status: string
  createdAt: Date
}

export async function listFaqCandidates(opts: {
  clientSlug?: string
  status?: string
}): Promise<FaqCandidate[]> {
  const clientId = await clientIdFromSlug(opts.clientSlug)
  const rows = await prisma.faq_candidates.findMany({
    where: { ...(clientId ? { client_id: clientId } : {}), status: opts.status ?? 'pending' },
    orderBy: { created_at: 'desc' },
    take: 200,
  })
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    source: r.source,
    customerQuestion: r.customer_question,
    humanAnswer: r.human_answer,
    suggestedQuestion: r.suggested_question,
    suggestedAnswer: r.suggested_answer,
    suggestedCategory: r.suggested_category,
    distilled: r.distilled,
    skipReason: r.skip_reason,
    status: r.status,
    createdAt: r.created_at,
  }))
}

export type FilteredMail = {
  id: string
  fromAddress: string | null
  fromName: string | null
  subject: string | null
  snippet: string | null
  isSpam: boolean
  status: string // skipped_spam | skipped_loop
  reason: string | null
  receivedAt: Date
}

/** Maile odfiltrowane przez spam/loop filtr (do weryfikacji poprawności filtra). */
export async function listFilteredMails(opts: {
  clientSlug?: string
  limit?: number
}): Promise<FilteredMail[]> {
  const clientId = await clientIdFromSlug(opts.clientSlug)
  const rows = await prisma.email_inbound.findMany({
    where: {
      ...(clientId ? { client_id: clientId } : {}),
      status: { in: ['skipped_spam', 'skipped_loop'] },
    },
    orderBy: { received_at: 'desc' },
    take: opts.limit ?? 200,
    select: {
      id: true,
      from_address: true,
      from_name: true,
      subject: true,
      snippet: true,
      is_spam: true,
      status: true,
      skip_reason: true,
      received_at: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    fromAddress: r.from_address,
    fromName: r.from_name,
    subject: r.subject,
    snippet: r.snippet,
    isSpam: r.is_spam,
    status: r.status,
    reason: r.skip_reason,
    receivedAt: r.received_at,
  }))
}

export async function filteredMailCount(clientSlug?: string): Promise<number> {
  const clientId = await clientIdFromSlug(clientSlug)
  return prisma.email_inbound.count({
    where: {
      ...(clientId ? { client_id: clientId } : {}),
      status: { in: ['skipped_spam', 'skipped_loop'] },
    },
  })
}

export type AllegroReturnRow = {
  id: string
  returnId: string
  referenceNumber: string | null
  orderId: string | null
  buyerLogin: string | null
  buyerEmail: string | null
  status: string | null
  items: { name: string; quantity: number | null; price: string | null }[]
  refundText: string | null
  allegroUrl: string
  createdAt: Date | null
}

const SALESCENTER_RETURN_URL = 'https://salescenter.allegro.com/returns/'

/** Lista zwrotów Allegro (osobna strona /zwroty). */
export async function listAllegroReturns(opts: {
  clientSlug?: string
  limit?: number
}): Promise<AllegroReturnRow[]> {
  const clientId = await clientIdFromSlug(opts.clientSlug)
  const rows = await prisma.allegro_returns.findMany({
    where: { ...(clientId ? { client_id: clientId } : {}) },
    orderBy: { created_at: 'desc' },
    take: opts.limit ?? 200,
  })
  return rows.map((r) => {
    const items = coerceArr(r.items).map((it) => ({
      name: String(it.name ?? (it.offer as Record<string, unknown>)?.name ?? 'pozycja'),
      quantity: typeof it.quantity === 'number' ? it.quantity : null,
      price: ((it.price as Record<string, unknown>)?.amount as string) ?? null,
    }))
    const refund = coerceObj(r.refund)
    const bank = coerceObj(refund.bankAccount)
    const refundText = bank.owner ? `przelew → ${String(bank.owner)}` : null
    return {
      id: r.id,
      returnId: r.return_id,
      referenceNumber: r.reference_number,
      orderId: r.order_id,
      buyerLogin: r.buyer_login,
      buyerEmail: r.buyer_email,
      status: r.status,
      items,
      refundText,
      allegroUrl: SALESCENTER_RETURN_URL + r.return_id,
      createdAt: r.return_created_at ?? r.created_at,
    }
  })
}

export async function allegroReturnsCount(clientSlug?: string): Promise<number> {
  const clientId = await clientIdFromSlug(clientSlug)
  return prisma.allegro_returns.count({ where: { ...(clientId ? { client_id: clientId } : {}) } })
}

export async function faqCandidateCount(clientSlug?: string): Promise<number> {
  const clientId = await clientIdFromSlug(clientSlug)
  return prisma.faq_candidates.count({
    where: { ...(clientId ? { client_id: clientId } : {}), status: 'pending' },
  })
}

export type Mailbox = { address: string; provider: string }

/** Skrzynki tenanta z config.integrations.email_mailboxes (do compose). */
function coerceArr(v: unknown): Record<string, unknown>[] {
  // driver adapter Prismy bywa zwraca jsonb jako STRING → parsujemy
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? (p as Record<string, unknown>[]) : []
    } catch {
      return []
    }
  }
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}

function coerceObj(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

export async function getMailboxes(clientSlug?: string): Promise<Mailbox[]> {
  if (!clientSlug) return []
  const c = await prisma.clients.findUnique({ where: { slug: clientSlug }, select: { config: true } })
  // config / integrations bywają double-encoded (string w jsonb) → coerce
  const cfg = coerceObj(c?.config)
  const integ = coerceObj(cfg.integrations)
  const list = integ.email_mailboxes
  if (!Array.isArray(list)) return []
  return list
    .filter((m): m is { address: string; provider?: string } =>
      !!m && typeof m === 'object' && typeof (m as { address?: unknown }).address === 'string',
    )
    .map((m) => ({ address: m.address, provider: m.provider ?? 'imap' }))
}
