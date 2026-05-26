import Link from 'next/link'
import { MessageCircle, AlertTriangle, CheckCircle2, Zap, TrendingUp, Sparkles, HelpCircle } from 'lucide-react'

import { getDashboardMetrics } from '@/queries/dashboard'
import { fmtDateTime } from '@/lib/datetime'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', voice: 'Telefon', idobooking: 'IdoBooking',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: 'Otwarta', color: 'bg-emerald-100 text-emerald-700' },
  escalated: { label: 'Eskalacja', color: 'bg-red-100 text-red-700' },
  closed: { label: 'Zamknięta', color: 'bg-slate-100 text-slate-500' },
}

export default async function DashboardPage() {
  const m = await getDashboardMetrics(CLIENT_SLUG)

  // Cele referencyjne
  const autoResolveOk = m.autoResolveRate >= 60
  const latencyOk = m.latencyP95Ms < 5000

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">
          Przegląd aktywności bota za ostatnie 7 dni.
        </p>
      </header>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Konwersacje (7d)"
          value={m.conversations7d}
          hint={`${m.conversations30d} w 30d, śr. ${m.messagesAvg7d} wiadomości / rozmowę`}
          icon={<MessageCircle className="h-4 w-4" />}
        />
        <MetricCard
          label="Auto-resolve rate"
          value={`${m.autoResolveRate}%`}
          hint="cel: ≥60% (bez eskalacji)"
          icon={<Sparkles className="h-4 w-4" />}
          status={autoResolveOk ? 'good' : 'warning'}
        />
        <MetricCard
          label="Nierozwiązane eskalacje"
          value={m.unresolvedEscalations}
          hint="aktualnie czekają na recepcję"
          icon={<AlertTriangle className="h-4 w-4" />}
          status={m.unresolvedEscalations === 0 ? 'good' : 'warning'}
          href={m.unresolvedEscalations > 0 ? '/escalations' : undefined}
        />
        <MetricCard
          label="Latencja p95"
          value={m.latencyP95Ms > 0 ? `${m.latencyP95Ms} ms` : '—'}
          hint={m.latencyAvgMs > 0 ? `avg ${m.latencyAvgMs} ms · cel <5s` : 'brak danych'}
          icon={<Zap className="h-4 w-4" />}
          status={m.latencyP95Ms === 0 ? 'neutral' : latencyOk ? 'good' : 'warning'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top FAQ */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Top FAQ (po trafieniach)</h2>
          </div>
          {m.topFaq.length === 0 ? (
            <div className="text-xs text-slate-400 py-4">
              Brak trafień — bot jeszcze nie używał FAQ
            </div>
          ) : (
            <div className="space-y-2">
              {m.topFaq.map((f, i) => (
                <Link
                  key={f.id}
                  href={`/faq/${f.id}/edit`}
                  className="flex items-start gap-3 p-2 -mx-2 rounded hover:bg-slate-50"
                >
                  <span className="text-xs font-mono text-slate-400 w-4 shrink-0 mt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 line-clamp-2">{f.question}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {f.category} · <span className="font-mono">{f.hitCount}</span> trafień
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Channels distribution */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Kanały (30d)</h2>
          </div>
          {m.byChannel.length === 0 ? (
            <div className="text-xs text-slate-400 py-4">Brak konwersacji w ostatnich 30 dniach</div>
          ) : (
            <div className="space-y-2">
              {m.byChannel.sort((a, b) => b.count - a.count).map((c) => {
                const total = m.byChannel.reduce((s, x) => s + x.count, 0)
                const pct = Math.round((c.count / total) * 100)
                return (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                      <span className="text-slate-500 font-mono">{c.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Ostatnia aktywność</h2>
          </div>
          {m.recentConversations.length === 0 ? (
            <div className="text-xs text-slate-400 py-4">Brak konwersacji</div>
          ) : (
            <div className="space-y-2">
              {m.recentConversations.slice(0, 8).map((c) => {
                const stmeta = STATUS_LABEL[c.status] ?? STATUS_LABEL.open
                return (
                  <Link
                    key={c.id}
                    href={`/conversations/${c.id}`}
                    className="flex items-center justify-between gap-2 p-1.5 -mx-1.5 rounded hover:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-900 truncate">
                        {c.guestName ?? 'Anonim'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {CHANNEL_LABEL[c.channel] ?? c.channel} · {c.messageCount} wiad. · {fmtDateTime(c.lastMessageAt)}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${stmeta.color}`}>
                      {stmeta.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* CTA do FAQ jeśli pusty */}
      {m.conversations7d === 0 && (
        <div className="rounded-lg border border-dashed border-indigo-300 bg-indigo-50 p-6 text-center">
          <Sparkles className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-900">Bot jeszcze nie miał konwersacji</h3>
          <p className="text-sm text-slate-600 mt-1">
            Sprawdź czy klucze API IdoBooking i Twilio są skonfigurowane, oraz czy FAQ ma uzupełnione odpowiedzi.
          </p>
          <div className="mt-3 flex items-center gap-2 justify-center">
            <Link href="/settings/integrations" className="text-xs text-indigo-600 hover:underline">
              Sprawdź integracje →
            </Link>
            <Link href="/faq" className="text-xs text-indigo-600 hover:underline">
              Otwórz FAQ →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label, value, hint, icon, status = 'neutral', href,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
  status?: 'good' | 'warning' | 'neutral'
  href?: string
}) {
  const statusClass = {
    good: 'text-emerald-600',
    warning: 'text-amber-600',
    neutral: 'text-slate-900',
  }[status]

  const card = (
    <div className={`rounded-lg border p-5 transition-all ${href ? 'hover:border-indigo-300 hover:shadow-sm cursor-pointer' : ''} ${status === 'warning' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
        {icon && <span className={statusClass}>{icon}</span>}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${statusClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )

  return href ? <Link href={href}>{card}</Link> : card
}
