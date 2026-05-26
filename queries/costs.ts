import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type ServiceBreakdown = {
  service: string
  units: string
  unit_type: string
  cost_usd: string
  cost_pln: string | null
  line_count: number
}

export type ConversationCostSummary = {
  conversationId: string
  total_usd: string
  total_pln: string
  breakdown: ServiceBreakdown[]
}

export async function getConversationCosts(
  conversationId: string,
): Promise<ConversationCostSummary> {
  const rows = await prisma.$queryRaw<
    Array<{
      service: string
      units: Prisma.Decimal
      unit_type: string
      cost_usd: Prisma.Decimal
      cost_pln: Prisma.Decimal | null
      line_count: bigint
    }>
  >`
    SELECT service,
           SUM(units)    AS units,
           MIN(unit_type) AS unit_type,
           SUM(cost_usd) AS cost_usd,
           SUM(cost_pln) AS cost_pln,
           COUNT(*)      AS line_count
    FROM conversation_costs
    WHERE conversation_id = ${conversationId}::uuid
    GROUP BY service
    ORDER BY SUM(cost_pln) DESC NULLS LAST
  `

  let totalUsd = new Prisma.Decimal(0)
  let totalPln = new Prisma.Decimal(0)
  for (const r of rows) {
    totalUsd = totalUsd.plus(r.cost_usd ?? 0)
    if (r.cost_pln) totalPln = totalPln.plus(r.cost_pln)
  }

  return {
    conversationId,
    total_usd: totalUsd.toString(),
    total_pln: totalPln.toString(),
    breakdown: rows.map((r) => ({
      service: r.service,
      units: r.units.toString(),
      unit_type: r.unit_type,
      cost_usd: r.cost_usd.toString(),
      cost_pln: r.cost_pln?.toString() ?? null,
      line_count: Number(r.line_count),
    })),
  }
}

// --- Billing dashboard ---

export type MonthlyServiceTotal = {
  service: string
  cost_pln: string
  cost_usd: string
  units: string
  unit_type: string
}

export type MonthlySummary = {
  month: string // 'YYYY-MM'
  total_pln: string
  total_usd: string
  conversation_count: number
  byService: MonthlyServiceTotal[]
}

export async function getMonthlySummary(
  clientSlug: string,
  monthIso: string,
): Promise<MonthlySummary> {
  // monthIso = 'YYYY-MM-01'
  const start = new Date(monthIso)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  const rows = await prisma.$queryRaw<
    Array<{
      service: string
      cost_pln: Prisma.Decimal | null
      cost_usd: Prisma.Decimal
      units: Prisma.Decimal
      unit_type: string
    }>
  >`
    SELECT cc.service,
           SUM(cc.cost_pln) AS cost_pln,
           SUM(cc.cost_usd) AS cost_usd,
           SUM(cc.units)    AS units,
           MIN(cc.unit_type) AS unit_type
    FROM conversation_costs cc
    JOIN clients c ON c.id = cc.client_id
    WHERE c.slug = ${clientSlug}
      AND cc.created_at >= ${start}
      AND cc.created_at < ${end}
    GROUP BY cc.service
    ORDER BY SUM(cc.cost_pln) DESC NULLS LAST
  `

  const convCountRow = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(DISTINCT cc.conversation_id) AS cnt
    FROM conversation_costs cc
    JOIN clients c ON c.id = cc.client_id
    WHERE c.slug = ${clientSlug}
      AND cc.conversation_id IS NOT NULL
      AND cc.created_at >= ${start}
      AND cc.created_at < ${end}
  `

  let totalPln = new Prisma.Decimal(0)
  let totalUsd = new Prisma.Decimal(0)
  for (const r of rows) {
    if (r.cost_pln) totalPln = totalPln.plus(r.cost_pln)
    totalUsd = totalUsd.plus(r.cost_usd ?? 0)
  }

  return {
    month: monthIso.slice(0, 7),
    total_pln: totalPln.toString(),
    total_usd: totalUsd.toString(),
    conversation_count: Number(convCountRow[0]?.cnt ?? 0),
    byService: rows.map((r) => ({
      service: r.service,
      cost_pln: r.cost_pln?.toString() ?? '0',
      cost_usd: r.cost_usd.toString(),
      units: r.units.toString(),
      unit_type: r.unit_type,
    })),
  }
}

export type TopConversation = {
  conversation_id: string
  guest_name: string | null
  channel: string
  cost_pln: string
  cost_usd: string
  duration_minutes: string | null
  message_count: number
  has_escalation: boolean
  created_at: Date
}

export async function getTopConversations(
  clientSlug: string,
  monthIso: string,
  limit = 5,
): Promise<TopConversation[]> {
  const start = new Date(monthIso)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  const rows = await prisma.$queryRaw<
    Array<{
      conversation_id: string
      guest_name: string | null
      channel: string
      cost_pln: Prisma.Decimal
      cost_usd: Prisma.Decimal
      duration_minutes: Prisma.Decimal | null
      message_count: bigint
      has_escalation: boolean
      created_at: Date
    }>
  >`
    SELECT conv.id AS conversation_id,
           conv.guest_name,
           conv.channel,
           SUM(cc.cost_pln) AS cost_pln,
           SUM(cc.cost_usd) AS cost_usd,
           SUM(CASE WHEN cc.unit_type = 'minutes' THEN cc.units ELSE 0 END) AS duration_minutes,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conv.id) AS message_count,
           EXISTS(SELECT 1 FROM escalations e WHERE e.conversation_id = conv.id) AS has_escalation,
           conv.created_at
    FROM conversation_costs cc
    JOIN conversations conv ON conv.id = cc.conversation_id
    JOIN clients c ON c.id = cc.client_id
    WHERE c.slug = ${clientSlug}
      AND cc.created_at >= ${start}
      AND cc.created_at < ${end}
    GROUP BY conv.id, conv.guest_name, conv.channel, conv.created_at
    ORDER BY SUM(cc.cost_pln) DESC NULLS LAST
    LIMIT ${limit}
  `

  return rows.map((r) => ({
    conversation_id: r.conversation_id,
    guest_name: r.guest_name,
    channel: r.channel,
    cost_pln: r.cost_pln.toString(),
    cost_usd: r.cost_usd.toString(),
    duration_minutes: r.duration_minutes?.toString() ?? null,
    message_count: Number(r.message_count),
    has_escalation: r.has_escalation,
    created_at: r.created_at,
  }))
}

export async function getAvailableMonths(clientSlug: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ m: Date }>>`
    SELECT DISTINCT date_trunc('month', cc.created_at) AS m
    FROM conversation_costs cc
    JOIN clients c ON c.id = cc.client_id
    WHERE c.slug = ${clientSlug}
    ORDER BY m DESC
    LIMIT 24
  `
  return rows.map((r) => r.m.toISOString().slice(0, 7))
}
