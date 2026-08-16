import { prisma } from '@/lib/prisma'
import { getMarginMultiplier } from '@/lib/cost-format'

// ============================================================
// Dashboard — dane pod redesign (kafle KPI + sparkline'y, eskalacje,
// ostatnie rozmowy, kanały 30d). Formatowanie/etykiety/progi statusu
// zostają w page.tsx (jak dotychczas — CHANNEL_LABEL, STATUS_LABEL,
// autoResolveOk itp. tam mieszkały), tu tylko surowe/liczbowe dane.
// ============================================================

export type DashboardMetrics = {
  // Konwersacje 30 dni + porównanie do poprzednich 30 dni + trend dzienny
  conversations30d: number
  conversations30dPrev: number
  conversationsSpark: number[]

  // Auto-resolve rate — definicja jak w poprzedniej wersji dashboardu:
  // (konwersacje 7d - eskalowane 7d) / konwersacje 7d. Trend pokazuje
  // dzienny % z ostatnich 30 dni (szerszy kontekst niż sama wartość 7d).
  autoResolveRate: number
  autoResolveSpark: number[]

  // Eskalacje otwarte
  unresolvedEscalations: number
  unresolvedEscalationsOver24h: number
  escalationsSpark: number[]
  openEscalations: {
    id: string
    reason: string
    summary: string | null
    severity: string
    escalatedTo: string | null
    channel: string
    createdAt: Date
  }[]

  // Koszt / rozmowa (30 dni) — z conversation_costs, ta sama definicja co na
  // stronie /billing: SUM(cost_pln) + marża (lib/cost-format.getMarginMultiplier,
  // domyślnie 20%). Różnica względem /billing: tu dzielimy przez WSZYSTKIE
  // konwersacje z okna (nie tylko te z kosztem) — to realny koszt jednostkowy
  // bota, nie tylko rozmów rozliczanych. Gdy cost_pln nie jest wypełnione dla
  // klienta (brak reconciliation), spadamy do cost_usd (zawsze NOT NULL).
  hasCostData: boolean
  costTotalUsd30d: number
  costTotalPln30d: number | null
  costPerConversationUsd: number | null
  costPerConversationPln: number | null
  costSpark: number[]

  byChannel: { channel: string; count: number }[]

  recentConversations: {
    id: string
    channel: string
    guestName: string | null
    lastMessageAt: Date
    takenOver: boolean
    snippet: string | null
  }[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Gęsta lista kluczy dni (UTC), `days` sztuk, kończąca się dziś. Wypełnia
 * dziury zerami tak, by sparkline nie zgniatał się przy niskim wolumenie. */
function denseDayKeys(days: number): string[] {
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayUtc)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(utcDateKey(d))
  }
  return out
}

function trimSnippet(s: string | null | undefined, max = 140): string | null {
  if (!s) return null
  const clean = s.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

type ConvDayRow = { day: Date; total: number; escalated: number }
type EscDayRow = { day: Date; n: number }
type CostDayRow = { day: Date; cost_pln: number | null; cost_usd: number | null }

export async function getDashboardMetrics(clientSlug: string): Promise<DashboardMetrics> {
  const now = new Date()
  // Okna filtrów w zapytaniach są celowo szersze niż liczba dni w serii —
  // dociągamy zapas, a gęste wypełnienie dni (denseDayKeys) i tak przycina
  // wynik do dokładnej liczby dni w kalendarzu UTC.
  const since30dFilter = new Date(now.getTime() - 31 * DAY_MS)
  const since60dFilter = new Date(now.getTime() - 61 * DAY_MS)
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const since30dGroupBy = new Date(now.getTime() - 30 * DAY_MS)

  const baseClient = { clients: { slug: clientSlug } }

  const [
    convDayRows,
    escDayRows,
    costDayRows,
    unresolvedEscalations,
    unresolvedEscalationsOver24h,
    byChannelRaw,
    openEscalationsRaw,
    recentRaw,
  ] = await Promise.all([
    prisma.$queryRaw<ConvDayRow[]>`
      SELECT
        date_trunc('day', c.created_at)::date AS day,
        count(*)::int AS total,
        count(*) FILTER (WHERE c.status = 'escalated')::int AS escalated
      FROM conversations c
      JOIN clients cl ON cl.id = c.client_id
      WHERE cl.slug = ${clientSlug} AND c.created_at >= ${since60dFilter}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<EscDayRow[]>`
      SELECT date_trunc('day', e.created_at)::date AS day, count(*)::int AS n
      FROM escalations e
      JOIN clients cl ON cl.id = e.client_id
      WHERE cl.slug = ${clientSlug} AND e.created_at >= ${since30dFilter}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<CostDayRow[]>`
      SELECT
        date_trunc('day', cc.created_at)::date AS day,
        sum(cc.cost_pln)::float AS cost_pln,
        sum(cc.cost_usd)::float AS cost_usd
      FROM conversation_costs cc
      JOIN clients cl ON cl.id = cc.client_id
      WHERE cl.slug = ${clientSlug} AND cc.created_at >= ${since30dFilter}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.escalations.count({ where: { ...baseClient, resolved_at: null } }),
    prisma.escalations.count({
      where: { ...baseClient, resolved_at: null, created_at: { lt: since24h } },
    }),
    prisma.conversations.groupBy({
      by: ['channel'],
      where: { ...baseClient, created_at: { gte: since30dGroupBy } },
      _count: true,
    }),
    prisma.escalations.findMany({
      where: { ...baseClient, resolved_at: null },
      orderBy: { created_at: 'asc' },
      take: 5,
      select: {
        id: true,
        reason: true,
        severity: true,
        summary: true,
        escalated_to: true,
        created_at: true,
        conversations: { select: { channel: true } },
      },
    }),
    prisma.conversations.findMany({
      where: baseClient,
      orderBy: { last_message_at: 'desc' },
      take: 5,
      select: {
        id: true,
        channel: true,
        guest_name: true,
        guest_phone: true,
        last_message_at: true,
        taken_over_at: true,
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { content: true },
        },
      },
    }),
  ])

  // ── Konwersacje: serię 60-dniową dzielimy na bieżące 30d i poprzednie 30d ──
  const convDayMap = new Map(convDayRows.map((r) => [utcDateKey(r.day), r]))
  const days60 = denseDayKeys(60)
  const convSeries = days60.map(
    (k) => convDayMap.get(k) ?? { day: new Date(k), total: 0, escalated: 0 }
  )
  const last30 = convSeries.slice(30)
  const prev30 = convSeries.slice(0, 30)
  const conversations30d = last30.reduce((a, d) => a + d.total, 0)
  const conversations30dPrev = prev30.reduce((a, d) => a + d.total, 0)
  const conversationsSpark = last30.map((d) => d.total)

  // ── Auto-resolve rate: definicja zachowana z poprzedniej wersji (7d) ──
  const last7 = last30.slice(-7)
  const total7 = last7.reduce((a, d) => a + d.total, 0)
  const escalated7 = last7.reduce((a, d) => a + d.escalated, 0)
  const autoResolveRate = total7 > 0 ? Math.round(((total7 - escalated7) / total7) * 100) : 0
  const autoResolveSpark = last30.map((d) =>
    d.total > 0 ? Math.round(((d.total - d.escalated) / d.total) * 100) : 0
  )

  // ── Eskalacje: trend nowych zgłoszeń dzień po dniu ──
  const escDayMap = new Map(escDayRows.map((r) => [utcDateKey(r.day), r.n]))
  const days30 = denseDayKeys(30)
  const escalationsSpark = days30.map((k) => escDayMap.get(k) ?? 0)

  // ── Koszty: SUM(cost_pln) + marża, jak na /billing. Fallback do cost_usd
  // (zawsze NOT NULL) gdy cost_pln nie jest wypełnione dla tego klienta.
  const marginMult = getMarginMultiplier()
  const costDayMapPln = new Map(costDayRows.map((r) => [utcDateKey(r.day), (r.cost_pln ?? 0) * marginMult]))
  const costDayMapUsd = new Map(costDayRows.map((r) => [utcDateKey(r.day), (r.cost_usd ?? 0) * marginMult]))
  const costSparkPln = days30.map((k) => costDayMapPln.get(k) ?? 0)
  const costSparkUsd = days30.map((k) => costDayMapUsd.get(k) ?? 0)
  const hasCostData = costDayRows.length > 0
  const costTotalPlnRaw30d = costSparkPln.reduce((a, b) => a + b, 0)
  const costTotalUsd30d = costSparkUsd.reduce((a, b) => a + b, 0)
  const costTotalPln30d = hasCostData && costTotalPlnRaw30d > 0 ? costTotalPlnRaw30d : null
  const costSpark = costTotalPln30d !== null ? costSparkPln : costSparkUsd
  const costPerConversationUsd =
    hasCostData && conversations30d > 0 ? costTotalUsd30d / conversations30d : null
  const costPerConversationPln =
    costTotalPln30d !== null && conversations30d > 0 ? costTotalPln30d / conversations30d : null

  return {
    conversations30d,
    conversations30dPrev,
    conversationsSpark,
    autoResolveRate,
    autoResolveSpark,
    unresolvedEscalations,
    unresolvedEscalationsOver24h,
    escalationsSpark,
    openEscalations: openEscalationsRaw.map((e) => ({
      id: e.id,
      reason: e.reason,
      summary: e.summary,
      severity: e.severity,
      escalatedTo: e.escalated_to,
      channel: e.conversations?.channel ?? 'unknown',
      createdAt: e.created_at,
    })),
    hasCostData,
    costTotalUsd30d,
    costTotalPln30d,
    costPerConversationUsd,
    costPerConversationPln,
    costSpark,
    byChannel: byChannelRaw.map((b) => ({ channel: b.channel, count: b._count })),
    recentConversations: recentRaw.map((r) => ({
      id: r.id,
      channel: r.channel,
      guestName: r.guest_name ?? r.guest_phone ?? null,
      lastMessageAt: r.last_message_at,
      takenOver: !!r.taken_over_at,
      snippet: trimSnippet(r.messages[0]?.content),
    })),
  }
}
