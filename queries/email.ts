import { prisma } from '@/lib/prisma'

export type EmailThreadRow = {
  id: string
  status: string
  guestEmail: string | null
  guestName: string | null
  inboxAddress: string | null
  subject: string | null
  lastMessageAt: Date
  draftId: string | null
  draftStatus: string | null
  draftOrigin: string | null
  draftEscalated: boolean
}

/** Lista wątków mailowych (channel='email') z ostatnim draftem + tematem. */
export async function listEmailThreads(opts: {
  clientSlug?: string
  status?: string // 'all' | 'open' | 'escalated' | 'closed'
  limit?: number
}): Promise<EmailThreadRow[]> {
  const where: { channel: string; clients?: { slug: string }; status?: string } = { channel: 'email' }
  if (opts.clientSlug) where.clients = { slug: opts.clientSlug }
  if (opts.status && opts.status !== 'all') where.status = opts.status

  const convs = await prisma.conversations.findMany({
    where,
    orderBy: { last_message_at: 'desc' },
    take: opts.limit ?? 100,
    select: {
      id: true,
      status: true,
      guest_email: true,
      guest_name: true,
      inbox_address: true,
      last_message_at: true,
    },
  })
  const ids = convs.map((c) => c.id)
  if (ids.length === 0) return []

  const drafts = await prisma.email_drafts.findMany({
    where: { conversation_id: { in: ids } },
    orderBy: { created_at: 'desc' },
    select: { id: true, conversation_id: true, status: true, origin: true, escalated: true },
  })
  const lastDraft = new Map<string, (typeof drafts)[number]>()
  for (const d of drafts) if (!lastDraft.has(d.conversation_id)) lastDraft.set(d.conversation_id, d)

  const inbound = await prisma.email_inbound.findMany({
    where: { conversation_id: { in: ids } },
    orderBy: { received_at: 'desc' },
    select: { conversation_id: true, subject: true },
  })
  const lastSubject = new Map<string, string | null>()
  for (const i of inbound) {
    if (i.conversation_id && !lastSubject.has(i.conversation_id)) lastSubject.set(i.conversation_id, i.subject)
  }

  return convs.map((c) => {
    const d = lastDraft.get(c.id)
    return {
      id: c.id,
      status: c.status,
      guestEmail: c.guest_email,
      guestName: c.guest_name,
      inboxAddress: c.inbox_address,
      subject: lastSubject.get(c.id) ?? null,
      lastMessageAt: c.last_message_at,
      draftId: d?.id ?? null,
      draftStatus: d?.status ?? null,
      draftOrigin: d?.origin ?? null,
      draftEscalated: d?.escalated ?? false,
    }
  })
}

export type EmailThreadDetail = {
  id: string
  status: string
  guestEmail: string | null
  guestName: string | null
  inboxAddress: string | null
  messages: { role: string; content: string; createdAt: Date }[]
  drafts: {
    id: string
    subject: string
    bodyText: string | null
    bodyHtml: string | null
    status: string
    origin: string
    escalated: boolean
    toAddress: string
    mailboxAddress: string
    createdAt: Date
    sentAt: Date | null
  }[]
}

export async function getEmailThread(id: string): Promise<EmailThreadDetail | null> {
  const conv = await prisma.conversations.findFirst({
    where: { id, channel: 'email' },
    select: { id: true, status: true, guest_email: true, guest_name: true, inbox_address: true },
  })
  if (!conv) return null

  const [messages, drafts] = await Promise.all([
    prisma.messages.findMany({
      where: { conversation_id: id },
      orderBy: { created_at: 'asc' },
      select: { role: true, content: true, created_at: true },
    }),
    prisma.email_drafts.findMany({
      where: { conversation_id: id },
      orderBy: { created_at: 'asc' },
    }),
  ])

  return {
    id: conv.id,
    status: conv.status,
    guestEmail: conv.guest_email,
    guestName: conv.guest_name,
    inboxAddress: conv.inbox_address,
    messages: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.created_at })),
    drafts: drafts.map((d) => ({
      id: d.id,
      subject: d.subject,
      bodyText: d.body_text,
      bodyHtml: d.body_html,
      status: d.status,
      origin: d.origin,
      escalated: d.escalated,
      toAddress: d.to_address,
      mailboxAddress: d.mailbox_address,
      createdAt: d.created_at,
      sentAt: d.sent_at,
    })),
  }
}

export async function getEmailStats(clientSlug?: string) {
  const where: { channel: string; clients?: { slug: string } } = { channel: 'email' }
  if (clientSlug) where.clients = { slug: clientSlug }
  const [total, open, escalated] = await Promise.all([
    prisma.conversations.count({ where }),
    prisma.conversations.count({ where: { ...where, status: 'open' } }),
    prisma.conversations.count({ where: { ...where, status: 'escalated' } }),
  ])
  return { total, open, escalated }
}
