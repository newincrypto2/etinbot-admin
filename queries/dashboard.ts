import { prisma } from '@/lib/prisma'

export type DashboardMetrics = {
  conversations7d: number
  conversations30d: number
  messagesAvg7d: number
  autoResolveRate: number       // % konwersacji bez eskalacji
  unresolvedEscalations: number
  latencyAvgMs: number
  latencyP95Ms: number
  topFaq: { id: string; question: string; hitCount: number; category: string }[]
  recentConversations: {
    id: string
    channel: string
    guestName: string | null
    status: string
    lastMessageAt: Date
    messageCount: number
  }[]
  byChannel: { channel: string; count: number }[]
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export async function getDashboardMetrics(clientSlug: string): Promise<DashboardMetrics> {
  const now = new Date()
  const since7d = new Date(now.getTime() - SEVEN_DAYS_MS)
  const since30d = new Date(now.getTime() - THIRTY_DAYS_MS)

  const baseClient = { clients: { slug: clientSlug } }

  const [
    conversations7d,
    conversations30d,
    escalatedIn7d,
    unresolved,
    topFaq,
    recent,
    byChannel,
    latencyStats,
  ] = await Promise.all([
    prisma.conversations.count({
      where: { ...baseClient, created_at: { gte: since7d } },
    }),
    prisma.conversations.count({
      where: { ...baseClient, created_at: { gte: since30d } },
    }),
    prisma.conversations.count({
      where: { ...baseClient, created_at: { gte: since7d }, status: 'escalated' },
    }),
    prisma.escalations.count({
      where: { ...baseClient, resolved_at: null },
    }),
    prisma.faq.findMany({
      where: { ...baseClient, parent_id: null, language: 'pl', is_active: true },
      orderBy: { hit_count: 'desc' },
      take: 5,
      select: { id: true, question: true, hit_count: true, category: true },
    }),
    prisma.conversations.findMany({
      where: baseClient,
      orderBy: { last_message_at: 'desc' },
      take: 10,
      select: {
        id: true,
        channel: true,
        guest_name: true,
        guest_phone: true,
        status: true,
        last_message_at: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversations.groupBy({
      by: ['channel'],
      where: { ...baseClient, created_at: { gte: since30d } },
      _count: true,
    }),
    prisma.$queryRaw<{ avg: number | null; p95: number | null; count: bigint }[]>`
      SELECT
        AVG(latency_ms)::float AS avg,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::float AS p95,
        COUNT(*) AS count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN clients cl ON cl.id = c.client_id
      WHERE cl.slug = ${clientSlug}
        AND m.role = 'assistant'
        AND m.latency_ms IS NOT NULL
        AND m.created_at >= ${since7d}
    `,
  ])

  // Calculate auto-resolve rate (konwersacje bez eskalacji w 7d)
  const autoResolveRate = conversations7d > 0
    ? Math.round(((conversations7d - escalatedIn7d) / conversations7d) * 100)
    : 0

  // Avg messages per conversation
  const messageCount = await prisma.messages.count({
    where: {
      conversations: baseClient,
      created_at: { gte: since7d },
    },
  })
  const messagesAvg7d = conversations7d > 0
    ? Math.round((messageCount / conversations7d) * 10) / 10
    : 0

  const lat = latencyStats[0]
  return {
    conversations7d,
    conversations30d,
    messagesAvg7d,
    autoResolveRate,
    unresolvedEscalations: unresolved,
    latencyAvgMs: Math.round(lat?.avg ?? 0),
    latencyP95Ms: Math.round(lat?.p95 ?? 0),
    topFaq: topFaq.map((r) => ({
      id: r.id,
      question: r.question,
      hitCount: r.hit_count ? Number(r.hit_count) : 0,
      category: r.category,
    })),
    recentConversations: recent.map((r) => ({
      id: r.id,
      channel: r.channel,
      guestName: r.guest_name ?? r.guest_phone ?? null,
      status: r.status,
      lastMessageAt: r.last_message_at,
      messageCount: r._count.messages,
    })),
    byChannel: byChannel.map((b) => ({ channel: b.channel, count: b._count })),
  }
}
