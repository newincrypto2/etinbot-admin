import { prisma } from '@/lib/prisma'

export type EscalationListRow = {
  id: string
  conversationId: string
  reason: string
  severity: string
  escalatedTo: string | null
  notifiedAt: Date
  resolvedAt: Date | null
  resolvedBy: string | null
  resolutionNote: string | null
  newFaqId: string | null
  newFaqSuggested: boolean
  // Conversation snippet
  channel: string
  guestName: string | null
  guestPhone: string | null
  guestEmail: string | null
  language: string | null
  reservationId: string | null
  // Podsumowanie rozmowy (z post-call webhook ElevenLabs, prefix '[Summary] ')
  // ma pierwszeństwo nad lastUserMessage gdy dostępne
  summary: string | null
  // Fallback: ostatnia wiadomość gościa (gdy brak summary, np. SMS/WhatsApp)
  lastUserMessage: string | null
  lastUserMessageAt: Date | null
}

export async function listEscalations(opts: {
  clientSlug?: string
  status?: 'unresolved' | 'resolved' | 'all'
  reason?: string
  limit?: number
}): Promise<EscalationListRow[]> {
  const where: any = {}
  if (opts.clientSlug) where.clients = { slug: opts.clientSlug }
  if (opts.status === 'unresolved') where.resolved_at = null
  else if (opts.status === 'resolved') where.resolved_at = { not: null }
  if (opts.reason && opts.reason !== 'all') where.reason = opts.reason

  const rows = await prisma.escalations.findMany({
    where,
    orderBy: [{ resolved_at: { sort: 'desc', nulls: 'first' } }, { notified_at: 'desc' }],
    take: opts.limit ?? 200,
    select: {
      id: true,
      conversation_id: true,
      reason: true,
      severity: true,
      escalated_to: true,
      summary: true,
      notified_at: true,
      resolved_at: true,
      resolved_by: true,
      resolution_note: true,
      new_faq_id: true,
      new_faq_suggested: true,
      conversations: {
        select: {
          channel: true,
          guest_name: true,
          guest_phone: true,
          guest_email: true,
          language: true,
          reservation_id: true,
          // Pobieramy ostatnie 20 wiadomości — w mapowaniu wyciągamy
          // (a) ElevenLabs transcript_summary jako fallback dla voice
          // (b) ostatnią user message jako fallback dla SMS/WhatsApp
          messages: {
            orderBy: { created_at: 'desc' },
            take: 20,
            select: { content: true, role: true, model_used: true, created_at: true },
          },
        },
      },
    },
  })

  return rows.map((r) => {
    const allMsgs = r.conversations.messages
    const elevenSummaryMsg = allMsgs.find((m) => m.model_used === 'elevenlabs-summary')
    const elevenSummary = elevenSummaryMsg
      ? elevenSummaryMsg.content.replace(/^\[Summary\]\s*/, '').trim()
      : null
    const lastUserMsg = allMsgs.find((m) => m.role === 'user')
    return {
      id: r.id,
      conversationId: r.conversation_id,
      reason: r.reason,
      severity: r.severity,
      escalatedTo: r.escalated_to,
      notifiedAt: r.notified_at,
      resolvedAt: r.resolved_at,
      resolvedBy: r.resolved_by,
      resolutionNote: r.resolution_note,
      newFaqId: r.new_faq_id,
      newFaqSuggested: r.new_faq_suggested ?? false,
      channel: r.conversations.channel,
      guestName: r.conversations.guest_name,
      guestPhone: r.conversations.guest_phone,
      guestEmail: r.conversations.guest_email,
      language: r.conversations.language,
      reservationId: r.conversations.reservation_id,
      // Priorytet: 1) bot summary z escalate_to_human, 2) ElevenLabs transcript_summary,
      // 3) brak (UI pokaże fallback do lastUserMessage)
      summary: r.summary ?? elevenSummary,
      lastUserMessage: lastUserMsg?.content ?? null,
      lastUserMessageAt: lastUserMsg?.created_at ?? null,
    }
  })
}

export async function getEscalationStats(clientSlug: string) {
  const baseWhere = { clients: { slug: clientSlug } }
  const [unresolved, resolved, byReason] = await Promise.all([
    prisma.escalations.count({ where: { ...baseWhere, resolved_at: null } }),
    prisma.escalations.count({ where: { ...baseWhere, resolved_at: { not: null } } }),
    prisma.escalations.groupBy({
      by: ['reason'],
      where: baseWhere,
      _count: true,
    }),
  ])
  return {
    unresolved,
    resolved,
    total: unresolved + resolved,
    byReason: byReason.map((r) => ({ reason: r.reason, count: r._count })),
  }
}
