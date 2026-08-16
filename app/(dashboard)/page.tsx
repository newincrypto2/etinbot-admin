import Link from 'next/link'
import { AlertTriangle, MessageCircle, BarChart3, Boxes } from 'lucide-react'

import { getDashboardMetrics } from '@/queries/dashboard'
import { getActiveModules } from '@/lib/modules-server'
import { MODULES, matchPlan } from '@/lib/modules'
import { getCurrentPermissions } from '@/lib/permissions'
import { activeClientSlug } from '@/lib/tenant'
import { MetricCard, type MetricStatus } from './_components/MetricCard'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', voice: 'Telefon', idobooking: 'IdoBooking',
  webchat: 'Webchat', messenger: 'Messenger', allegro: 'Allegro (wiadomości)', allegro_issue: 'Allegro (reklamacje)',
}

// Etykiety powodów eskalacji — duplikat świadomy (jak w app/(dashboard)/escalations/page.tsx,
// tam też nie jest eksportowane); to czysta warstwa wyświetlania, nie logika.
const REASON_LABEL: Record<string, string> = {
  unknown_question: 'Nieznane pytanie',
  modification_request: 'Zmiana / anulowanie',
  complaint: 'Reklamacja',
  emergency: 'Sytuacja pilna',
  investment_inquiry: 'Zapytanie B2B / hurt',
  billing_dispute: 'Spór o płatność',
  other_human_needed: 'Inne — wymaga człowieka',
  auto_detected_from_response: 'Sprawa do obsługi',
  'user request': 'Prośba klienta o człowieka',
  b2b_inquiry: 'Zapytanie B2B / hurt',
  return_request: 'Zwrot',
  order_not_found: 'Nie znaleziono zamówienia',
}

function fmtRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'przed chwilą'
  if (min < 60) return `${min} min temu`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} godz. temu`
  const days = Math.floor(h / 24)
  if (days === 1) return 'wczoraj'
  return `${days} dni temu`
}

function fmtHM(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
}

function escSeverity(createdAt: Date, severity: string): 'crit' | 'warn' | 'none' {
  const ageHours = (Date.now() - createdAt.getTime()) / 3_600_000
  if (ageHours > 24) return 'crit'
  if (ageHours > 6 || severity === 'urgent') return 'warn'
  return 'none'
}

const ESC_BORDER: Record<'crit' | 'warn' | 'none', string> = {
  crit: 'border-l-red-500 bg-red-50/60',
  warn: 'border-l-amber-500 bg-amber-50/50',
  none: 'border-l-slate-200 bg-slate-50',
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
      {text}
    </div>
  )
}

export default async function DashboardPage() {
  const clientSlug = await activeClientSlug()
  const [m, modules, permissions] = await Promise.all([
    getDashboardMetrics(clientSlug),
    getActiveModules(),
    getCurrentPermissions(),
  ])

  const activeModuleCount = MODULES.filter((mod) => modules[mod.id]).length
  const plan = matchPlan(modules)
  const planLabel = plan ? plan.label : 'Zestaw własny'

  // ── KPI 1: Konwersacje 30 dni ──
  const conversationsDeltaPct =
    m.conversations30dPrev > 0
      ? Math.round(((m.conversations30d - m.conversations30dPrev) / m.conversations30dPrev) * 100)
      : m.conversations30d > 0
        ? 100
        : null
  const conversationsSub =
    conversationsDeltaPct === null
      ? 'brak danych z poprzedniego okresu'
      : `${conversationsDeltaPct >= 0 ? '+' : ''}${conversationsDeltaPct}% vs poprzedni okres`
  const conversationsStatus: MetricStatus =
    conversationsDeltaPct === null ? 'neutral' : conversationsDeltaPct >= 0 ? 'good' : 'warn'

  // ── KPI 2: Auto-resolve (definicja 7d, jak dotychczas) ──
  const autoResolveStatus: MetricStatus = m.autoResolveRate >= 60 ? 'good' : 'warn'

  // ── KPI 3: Otwarte eskalacje ──
  const escStatus: MetricStatus =
    m.unresolvedEscalations === 0 ? 'good' : m.unresolvedEscalationsOver24h > 0 ? 'warn' : 'neutral'
  const escSub =
    m.unresolvedEscalations === 0
      ? 'brak otwartych spraw'
      : m.unresolvedEscalationsOver24h > 0
        ? `${m.unresolvedEscalationsOver24h} powyżej 24 h`
        : 'wszystkie poniżej 24 h'

  // ── KPI 4: Koszt / rozmowa (30d) ──
  let costValue: string | number = '—'
  let costSub = 'brak danych o kosztach'
  if (m.hasCostData) {
    if (m.costTotalPln30d !== null && m.costPerConversationPln !== null) {
      costValue = `${m.costPerConversationPln.toFixed(2).replace('.', ',')} zł`
      costSub = `ledger: ${m.costTotalPln30d.toFixed(2).replace('.', ',')} zł / 30 dni`
    } else {
      costValue = `$${(m.costPerConversationUsd ?? 0).toFixed(3)}`
      costSub = `ledger: $${m.costTotalUsd30d.toFixed(2)} / 30 dni`
    }
  }

  const maxChannel = m.byChannel.length > 0 ? Math.max(...m.byChannel.map((c) => c.count)) : 0
  const sortedChannels = [...m.byChannel].sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">
          Konwersacje i koszty z ostatnich 30 dni, auto-resolve z ostatnich 7.
        </p>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Konwersacje · 30 dni"
          value={m.conversations30d}
          sub={conversationsSub}
          status={conversationsStatus}
          spark={m.conversationsSpark}
        />
        <MetricCard
          label="Auto-resolve"
          value={`${m.autoResolveRate}%`}
          sub="bez udziału człowieka (7d)"
          status={autoResolveStatus}
          spark={m.autoResolveSpark}
        />
        <MetricCard
          label="Otwarte eskalacje"
          value={m.unresolvedEscalations}
          sub={escSub}
          status={escStatus}
          spark={m.escalationsSpark}
          href={m.unresolvedEscalations > 0 ? '/escalations' : undefined}
        />
        <MetricCard
          label="Koszt / rozmowa"
          value={costValue}
          sub={costSub}
          status="neutral"
          spark={m.hasCostData ? m.costSpark : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="space-y-4">
          {/* Eskalacje wymagające uwagi */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Eskalacje wymagające uwagi</h2>
              <Link href="/escalations" className="ml-auto text-xs text-[#2E7CF0] hover:underline">
                Wszystkie →
              </Link>
            </div>
            {m.openEscalations.length === 0 ? (
              <EmptyState text="Brak otwartych eskalacji — bot radzi sobie sam." />
            ) : (
              <div className="space-y-2">
                {m.openEscalations.map((e) => {
                  const sev = escSeverity(e.createdAt, e.severity)
                  return (
                    <Link
                      key={e.id}
                      href="/escalations"
                      className={`block rounded-r-md border-l-4 px-3 py-2 ${ESC_BORDER[sev]}`}
                    >
                      <div className="text-sm font-medium text-slate-900 line-clamp-1">
                        {e.summary ?? REASON_LABEL[e.reason] ?? e.reason}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {CHANNEL_LABEL[e.channel] ?? e.channel} · {fmtRelative(e.createdAt)} ·{' '}
                        {e.escalatedTo ? `przypisane: ${e.escalatedTo}` : 'nieprzypisane'}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ostatnie rozmowy */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Ostatnie rozmowy</h2>
              <Link href="/conversations" className="ml-auto text-xs text-[#2E7CF0] hover:underline">
                Wszystkie →
              </Link>
            </div>
            {m.recentConversations.length === 0 ? (
              <EmptyState text="Brak konwersacji." />
            ) : (
              <div className="divide-y divide-slate-100">
                {m.recentConversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/conversations/${c.id}`}
                    className="flex items-center gap-2 py-2 px-1 -mx-1 rounded hover:bg-slate-50"
                  >
                    <span className="shrink-0 rounded-full bg-[#E3EDFD] px-2 py-0.5 font-mono text-[10px] tracking-wide text-[#24306E]">
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {c.snippet ?? c.guestName ?? '—'}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                        c.takenOver ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {c.takenOver ? 'przejęta' : 'bot'}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtHM(c.lastMessageAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Kanały 30 dni */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Kanały · 30 dni</h2>
            </div>
            {sortedChannels.length === 0 ? (
              <EmptyState text="Brak konwersacji w ostatnich 30 dniach." />
            ) : (
              <div className="space-y-2">
                {sortedChannels.map((c) => (
                  <div key={c.channel} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 truncate text-slate-700">
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-[#2E7CF0]"
                        style={{ width: `${maxChannel > 0 ? Math.round((c.count / maxChannel) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right font-mono text-[11px] text-slate-500">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pakiet modułów */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <Boxes className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Pakiet modułów</h2>
            </div>
            <p className="text-xs text-slate-500">
              {planLabel} · {activeModuleCount} z {MODULES.length} modułów aktywnych.
            </p>
            {permissions['clients.manage'] && (
              <Link href="/clients" className="mt-2 inline-block text-xs text-[#2E7CF0] hover:underline">
                Konfiguruj moduły →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
