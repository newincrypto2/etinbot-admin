import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, Calendar, Building2, AlertTriangle, User, ShoppingCart, Banknote, Truck } from 'lucide-react'

import { getConversation } from '@/queries/conversations'
import { getConversationCosts } from '@/queries/costs'
import { Badge } from '@/components/ui/badge'
import { fmtDateShort, fmtDateTimeSec } from '@/lib/datetime'
import { ConversationActions } from './_components/ConversationActions'
import { ConversationCosts } from './_components/ConversationCosts'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', voice: 'Telefon', idobooking: 'IdoBooking',
  webchat: 'Webchat', messenger: 'Messenger', allegro: 'Allegro (wiadomości)', allegro_issue: 'Allegro (reklamacje)',
}

const BUILDING_LABEL: Record<string, string> = {
  'silver-place': 'Silver Place',
  'silver-forest': 'Silver Forest',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: 'Otwarta', color: 'bg-emerald-100 text-emerald-700' },
  escalated: { label: 'Eskalacja', color: 'bg-red-100 text-red-700' },
  closed: { label: 'Zamknięta', color: 'bg-slate-100 text-slate-500' },
}

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  user: { label: 'Gość', color: 'bg-blue-50 border-blue-200 text-blue-900' },
  assistant: { label: 'Bot', color: 'bg-indigo-50 border-indigo-200 text-indigo-900' },
  tool: { label: 'Tool', color: 'bg-amber-50 border-amber-200 text-amber-900' },
  system: { label: 'System', color: 'bg-slate-50 border-slate-200 text-slate-700' },
}

export default async function ConversationDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const conv = await getConversation(id)
  if (!conv) notFound()

  const costs = await getConversationCosts(id)
  const stmeta = STATUS_LABEL[conv.status] ?? STATUS_LABEL.open

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/conversations" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do listy
      </Link>

      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {conv.guestName ?? conv.guestPhone ?? conv.guestEmail ?? (conv.channel === 'webchat' ? 'Gość (webchat)' : conv.channel === 'messenger' ? 'Gość (Messenger)' : conv.threadId)}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">{CHANNEL_LABEL[conv.channel] ?? conv.channel}</Badge>
            <Badge variant="secondary" className={stmeta.color}>{stmeta.label}</Badge>
            {conv.language && <Badge variant="outline">{conv.language.toUpperCase()}</Badge>}
            {conv.escalationCount > 0 && (
              <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {conv.escalationCount} {conv.escalationCount === 1 ? 'eskalacja' : conv.escalationCount < 5 ? 'eskalacje' : 'eskalacji'}
              </Badge>
            )}
          </div>
        </div>
        <ConversationActions id={conv.id} status={conv.status} />
      </header>

      {/* Metadane gościa */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
        {conv.vertical === 'ecommerce' ? (
          <>
            <Meta label="Telefon" value={conv.guestPhone} icon={<Phone className="h-3.5 w-3.5" />} mono />
            <Meta label="Email" value={conv.guestEmail} icon={<Mail className="h-3.5 w-3.5" />} />
            <Meta label="Imię" value={conv.guestName} icon={<User className="h-3.5 w-3.5" />} />
            <Meta
              label="Nr zamówienia"
              value={
                conv.order
                  ? conv.order.totalCount > 1
                    ? `#${conv.order.extId} · +${conv.order.totalCount - 1} więcej`
                    : `#${conv.order.extId}`
                  : null
              }
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              mono
            />
            <Meta
              label="Status zamówienia"
              value={
                conv.order
                  ? [
                      conv.order.status,
                      conv.order.total != null
                        ? `${conv.order.total.toFixed(2)} ${conv.order.currency ?? 'PLN'}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || null
                  : null
              }
              icon={<Banknote className="h-3.5 w-3.5" />}
            />
            {conv.order?.trackingNumber && (
              <Meta
                label="Tracking"
                value={conv.order.trackingNumber}
                href={conv.order.trackingUrl ?? undefined}
                icon={<Truck className="h-3.5 w-3.5" />}
                mono
              />
            )}
          </>
        ) : (
          <>
            <Meta label="Telefon" value={conv.guestPhone} icon={<Phone className="h-3.5 w-3.5" />} mono />
            <Meta label="Email" value={conv.guestEmail} icon={<Mail className="h-3.5 w-3.5" />} />
            <Meta label="Rezerwacja" value={conv.reservationId} icon={<Calendar className="h-3.5 w-3.5" />} mono />
            <Meta
              label="Apartament"
              value={
                conv.apartmentName
                  ? conv.apartmentBuilding
                    ? `${conv.apartmentName} · ${BUILDING_LABEL[conv.apartmentBuilding] ?? conv.apartmentBuilding}`
                    : conv.apartmentName
                  : conv.apartmentId?.slice(0, 8) ?? null
              }
              icon={<Building2 className="h-3.5 w-3.5" />}
            />
            <Meta
              label="Pobyt"
              value={
                conv.checkIn && conv.checkOut
                  ? `${fmtDateShort(conv.checkIn)} → ${fmtDateShort(conv.checkOut)}`
                  : null
              }
              icon={<Calendar className="h-3.5 w-3.5" />}
            />
          </>
        )}
      </div>

      {/* Wiadomości */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          Transkrypt ({conv.messages.length} {conv.messages.length === 1 ? 'wiadomość' : 'wiadomości'})
        </h2>

        {conv.messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Brak wiadomości w tym threadzie
          </div>
        ) : (
          <div className="space-y-2">
            {conv.messages.map((m) => {
              const rolemeta = ROLE_LABEL[m.role] ?? ROLE_LABEL.system
              // Prisma driver adapter zwraca jsonb jako STRING — bez parse tool calls
              // nigdy się nie renderowały (silent fail)
              const rawTc = typeof m.toolCalls === 'string'
                ? (() => { try { return JSON.parse(m.toolCalls) } catch { return null } })()
                : m.toolCalls
              const toolCalls = Array.isArray(rawTc) ? rawTc : null

              return (
                <div key={m.id} className={`rounded-lg border p-3 ${rolemeta.color}`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{rolemeta.label}</span>
                      {m.modelUsed && <code className="font-mono text-[10px] opacity-60">{m.modelUsed}</code>}
                      {m.bookingFiltered && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 text-amber-700 border-amber-300">
                          Booking filter
                        </Badge>
                      )}
                    </div>
                    <div className="opacity-50 font-mono">
                      {fmtDateTimeSec(m.createdAt)}
                      {m.latencyMs !== null && <span> · {m.latencyMs}ms</span>}
                      {(m.tokensIn !== null || m.tokensOut !== null) && (
                        <span> · {m.tokensIn ?? 0}↓ {m.tokensOut ?? 0}↑</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 text-sm whitespace-pre-wrap">{m.content}</div>
                  {toolCalls && toolCalls.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer opacity-70 hover:opacity-100">
                        🔧 {toolCalls.length} tool call{toolCalls.length === 1 ? '' : 's'}
                      </summary>
                      <pre className="mt-1 p-2 bg-white/50 rounded text-[11px] overflow-x-auto">
                        {JSON.stringify(toolCalls, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Koszt rozmowy — kompaktowo, na dole, rozwijane */}
      <ConversationCosts summary={costs} />
    </div>
  )
}

function Meta({
  label,
  value,
  icon,
  mono = false,
  href,
}: {
  label: string
  value: string | null | undefined
  icon: React.ReactNode
  mono?: boolean
  href?: string
}) {
  const inner = mono ? <code className="font-mono text-xs">{value}</code> : <span>{value}</span>
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
        {icon}{label}
      </div>
      <div className="mt-1 text-sm text-slate-900 font-medium">
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              {inner}
            </a>
          ) : (
            inner
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>
    </div>
  )
}
