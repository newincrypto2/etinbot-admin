import { prisma } from '@/lib/prisma'

export type ConversationListRow = {
  id: string
  channel: string
  threadId: string
  guestName: string | null
  guestPhone: string | null
  guestEmail: string | null
  reservationId: string | null
  language: string | null
  status: string
  lastMessageAt: Date
  createdAt: Date
  messageCount: number
  hasEscalation: boolean
  lastMessagePreview: string | null
}

export async function listConversations(opts: {
  clientSlug?: string
  status?: string         // 'all' | 'open' | 'escalated' | 'closed'
  channel?: string        // 'all' | 'whatsapp' | 'sms' | 'email' | 'voice' | 'idobooking'
  search?: string
  limit?: number
}): Promise<ConversationListRow[]> {
  const where: any = {}
  if (opts.clientSlug) where.clients = { slug: opts.clientSlug }
  if (opts.status && opts.status !== 'all') where.status = opts.status
  if (opts.channel && opts.channel !== 'all') where.channel = opts.channel
  if (opts.search) {
    where.OR = [
      { guest_name: { contains: opts.search, mode: 'insensitive' } },
      { guest_phone: { contains: opts.search, mode: 'insensitive' } },
      { guest_email: { contains: opts.search, mode: 'insensitive' } },
      { reservation_id: { contains: opts.search, mode: 'insensitive' } },
      { thread_id: { contains: opts.search, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.conversations.findMany({
    where,
    orderBy: { last_message_at: 'desc' },
    take: opts.limit ?? 100,
    select: {
      id: true,
      channel: true,
      thread_id: true,
      guest_name: true,
      guest_phone: true,
      guest_email: true,
      reservation_id: true,
      language: true,
      status: true,
      last_message_at: true,
      created_at: true,
      _count: { select: { messages: true, escalations: true } },
      messages: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { content: true, role: true },
      },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    threadId: r.thread_id,
    guestName: r.guest_name,
    guestPhone: r.guest_phone,
    guestEmail: r.guest_email,
    reservationId: r.reservation_id,
    language: r.language,
    status: r.status,
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
    messageCount: r._count.messages,
    hasEscalation: r._count.escalations > 0,
    lastMessagePreview: r.messages[0]?.content?.slice(0, 120) ?? null,
  }))
}

export type ConversationStats = {
  open: number
  escalated: number
  closed: number
  total: number
}

export async function getConversationStats(clientSlug: string): Promise<ConversationStats> {
  const groups = await prisma.conversations.groupBy({
    by: ['status'],
    where: { clients: { slug: clientSlug } },
    _count: true,
  })
  const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count]))
  return {
    open: byStatus.open ?? 0,
    escalated: byStatus.escalated ?? 0,
    closed: byStatus.closed ?? 0,
    total: (byStatus.open ?? 0) + (byStatus.escalated ?? 0) + (byStatus.closed ?? 0),
  }
}

export type MessageRow = {
  id: string
  role: string
  content: string
  toolCalls: any
  modelUsed: string | null
  latencyMs: number | null
  tokensIn: number | null
  tokensOut: number | null
  bookingFiltered: boolean | null
  createdAt: Date
}

export type ConversationOrder = {
  extId: string
  status: string | null
  total: number | null
  currency: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  dateAdd: Date | null
  /** ile zamówień ma ten klient (po emailu/telefonie) — żeby pokazać "+N więcej" */
  totalCount: number
}

export type ConversationDetail = {
  id: string
  channel: string
  threadId: string
  vertical: 'rental' | 'ecommerce'
  guestName: string | null
  guestPhone: string | null
  guestEmail: string | null
  reservationId: string | null
  apartmentId: string | null
  apartmentName: string | null
  apartmentBuilding: string | null
  checkIn: Date | null
  checkOut: Date | null
  order: ConversationOrder | null   // ecommerce: ostatnie zamówienie klienta
  language: string | null
  status: string
  lastMessageAt: Date
  createdAt: Date
  closedAt: Date | null
  messages: MessageRow[]
  escalationCount: number
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  // Scope po tenancie panelu (anty cross-tenant read po UUID we współdzielonej DB)
  const { panelClientId } = await import('@/lib/tenant')
  const conv = await prisma.conversations.findFirst({
    where: { id, client_id: await panelClientId() },
    select: {
      id: true,
      channel: true,
      thread_id: true,
      client_id: true,
      guest_name: true,
      guest_phone: true,
      guest_email: true,
      reservation_id: true,
      apartment_id: true,
      apartments: { select: { name: true, building_code: true } },
      clients: { select: { vertical: true } },
      language: true,
      status: true,
      last_message_at: true,
      created_at: true,
      closed_at: true,
      _count: { select: { escalations: true } },
      messages: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          tool_calls: true,
          model_used: true,
          latency_ms: true,
          tokens_in: true,
          tokens_out: true,
          booking_filtered: true,
          created_at: true,
        },
      },
    },
  })
  if (!conv) return null

  const vertical: 'rental' | 'ecommerce' =
    conv.clients?.vertical === 'ecommerce' ? 'ecommerce' : 'rental'

  // Ecommerce: dociągamy ostatnie zamówienie klienta z orders_cache po emailu/telefonie
  // (conversations nie ma order_id — bot identyfikuje zamówienie toolem find_order).
  let order: ConversationOrder | null = null
  if (vertical === 'ecommerce' && (conv.guest_email || conv.guest_phone)) {
    const or: any[] = []
    if (conv.guest_email) or.push({ customer_email: { equals: conv.guest_email, mode: 'insensitive' } })
    if (conv.guest_phone) or.push({ customer_phone: conv.guest_phone })
    const orderWhere = { client_id: conv.client_id, OR: or }
    const [latest, count] = await Promise.all([
      prisma.orders_cache.findFirst({
        where: orderWhere,
        orderBy: { date_add: 'desc' },
        select: {
          ext_id: true,
          status: true,
          status_id: true,
          total_pln: true,
          currency: true,
          tracking_number: true,
          tracking_url: true,
          date_add: true,
        },
      }),
      prisma.orders_cache.count({ where: orderWhere }),
    ])
    if (latest) {
      // status: preferuj nazwę z orders_cache; jeśli pusta — zmapuj status_id przez order_status_map
      let statusName = latest.status
      if (!statusName && latest.status_id != null) {
        const sm = await prisma.order_status_map.findUnique({
          where: { client_id_status_id: { client_id: conv.client_id, status_id: latest.status_id } },
          select: { status_name: true },
        })
        statusName = sm?.status_name ?? null
      }
      order = {
        extId: latest.ext_id,
        status: statusName,
        total: latest.total_pln ? Number(latest.total_pln) : null,
        currency: latest.currency,
        trackingNumber: latest.tracking_number,
        trackingUrl: latest.tracking_url,
        dateAdd: latest.date_add,
        totalCount: count,
      }
    }
  }

  // Fallback: zassij z reservations_cache jeśli conversations.guest_name / apartment są puste
  // ale mamy reservation_id (bot zidentyfikował gościa ale state.update_context był wcześniej)
  let resGuestName: string | null = null
  let resApartmentName: string | null = null
  let resApartmentBuilding: string | null = null
  let resCheckIn: Date | null = null
  let resCheckOut: Date | null = null
  if (conv.reservation_id) {
    // PK to triple (client_id, idobooking_tenant, reservation_id) — nie znamy tenant
    // z conversations, używamy findFirst (filter na 2 polach wystarczy w 99% przypadków,
    // bo reservation_id jest globalnie unikalne per tenant).
    const r = await prisma.reservations_cache.findFirst({
      where: {
        client_id: conv.client_id,
        reservation_id: conv.reservation_id,
      },
      select: {
        guest_name: true,
        check_in: true,
        check_out: true,
        apartments: { select: { name: true, building_code: true } },
      },
    })
    if (r) {
      resGuestName = r.guest_name
      resApartmentName = r.apartments?.name ?? null
      resApartmentBuilding = r.apartments?.building_code ?? null
      resCheckIn = r.check_in
      resCheckOut = r.check_out
    }
  }

  return {
    id: conv.id,
    channel: conv.channel,
    threadId: conv.thread_id,
    vertical,
    guestName: conv.guest_name ?? resGuestName,
    guestPhone: conv.guest_phone,
    guestEmail: conv.guest_email,
    reservationId: conv.reservation_id,
    apartmentId: conv.apartment_id,
    apartmentName: conv.apartments?.name ?? resApartmentName,
    apartmentBuilding: conv.apartments?.building_code ?? resApartmentBuilding,
    checkIn: resCheckIn,
    checkOut: resCheckOut,
    order,
    language: conv.language,
    status: conv.status,
    lastMessageAt: conv.last_message_at,
    createdAt: conv.created_at,
    closedAt: conv.closed_at,
    escalationCount: conv._count.escalations,
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.tool_calls,
      modelUsed: m.model_used,
      latencyMs: m.latency_ms,
      tokensIn: m.tokens_in,
      tokensOut: m.tokens_out,
      bookingFiltered: m.booking_filtered,
      createdAt: m.created_at,
    })),
  }
}
