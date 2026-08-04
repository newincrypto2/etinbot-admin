import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, User, Inbox, Paperclip, Download, ShoppingCart, Truck, Package, Briefcase, ExternalLink, AlertTriangle, Clock } from 'lucide-react'

import { getEmailThread, getCustomerOrders, getShipmentStatus, type ShipmentStatus } from '@/queries/email'
import { fmtFullDateTime, fmtDateShort } from '@/lib/datetime'
import { EmailReplyPanel } from './_components/EmailReplyPanel'
import { ThreadActions } from './_components/ThreadActions'
import { ForwardButton } from './_components/ForwardButton'
import { MessageBody } from './_components/MessageBody'

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  user: { label: 'Klient', color: 'bg-blue-50 border-blue-200 text-blue-900' },
  assistant: { label: 'Wysłane', color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  system: { label: 'System', color: 'bg-slate-50 border-slate-200 text-slate-700' },
}

function fmtBytes(n: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Kolor badge'a statusu przesyłki wg rodzaju (z backendu /api/tools/check_shipment)
function shipBadge(kind: string): string {
  if (kind === 'delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (kind === 'returned' || kind === 'problem' || kind === 'lost') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (kind === 'awaiting_pickup') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-sky-50 text-sky-700 border-sky-200' // in_transit / created / unknown
}

export default async function PocztaThreadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const thread = await getEmailThread(id)
  if (!thread) notFound()

  const orders = await getCustomerOrders(thread.clientId, thread.guestEmail)
  // Live status przesyłki (BaseLinker) dla zamówień z numerem nadania — równolegle, cap 5
  const shipMap = new Map<string, ShipmentStatus | null>()
  await Promise.all(
    orders
      .slice(0, 5)
      .filter((o) => o.trackingNumber)
      .map(async (o) => {
        const s = await getShipmentStatus(thread.clientSlug, o.shopOrderId ?? o.extId, thread.guestEmail)
        shipMap.set(o.extId, s)
      }),
  )
  const pendingDraft = [...thread.drafts].reverse().find((d) => d.status === 'draft') ?? null

  // Załączniki per wiadomość — N-ta wiadomość 'user' = N-ty inbound (ta sama kolejność)
  // Dla wiadomości wysłanych (assistant) doklejamy załączniki wysłanego draftu
  // (dopasowanie po treści) — żeby było widać, że odpowiedź miała załącznik.
  const norm = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim()
  const sentAtt = new Map<string, typeof thread.drafts[number]['attachments']>()
  for (const d of thread.drafts) {
    if (d.status === 'sent' && d.attachments.length) {
      const k = norm(d.bodyText ?? '')
      if (k && !sentAtt.has(k)) sentAtt.set(k, d.attachments)
    }
  }
  let _ui = 0
  const msgRows = thread.messages
    .filter((m) => m.role !== 'tool')
    .map((m) => {
      const inbound = m.role === 'user' ? thread.inbounds[_ui++] : undefined
      return {
        m,
        inboundId: inbound?.id ?? null,
        attachments:
          m.role === 'user'
            ? inbound?.attachments ?? []
            : (sentAtt.get(norm(m.content)) ?? []).map((a) => ({ ...a, downloadable: false })),
      }
    })

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/poczta" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do poczty
      </Link>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Główna kolumna */}
        <div className="space-y-5 min-w-0">
          <header className="flex items-start justify-between gap-4 flex-wrap">
            <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900">{thread.guestName ?? thread.guestEmail ?? 'Wątek'}</h1>
              {thread.tags?.includes('b2b') && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> B2B / hurt
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{thread.guestEmail ?? '—'}</span>
              <span className="inline-flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" />na {thread.inboxAddress ?? '—'}</span>
            </div>
            </div>
            <ThreadActions id={thread.id} status={thread.status} tags={thread.tags ?? []} />
          </header>

          {/* Box kontekstu reklamacji/dyskusji Allegro (z conversations.meta) */}
          {(() => {
            const meta = thread.meta as Record<string, unknown> | null
            if (!meta || meta.channel !== 'allegro_issue') return null
            const isClaim = String(meta.type ?? '').toUpperCase() === 'CLAIM'
            const exps = Array.isArray(meta.expectations) ? (meta.expectations as string[]) : []
            const lines = Array.isArray(meta.order_lines) ? (meta.order_lines as string[]) : []
            const url = typeof meta.allegro_url === 'string' ? meta.allegro_url : null
            return (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-semibold text-amber-900 inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    {isClaim ? 'Reklamacja Allegro' : 'Dyskusja Allegro'}
                    {meta.reference_number ? <span className="font-normal text-amber-700">· nr {String(meta.reference_number)}</span> : null}
                  </div>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                      <ExternalLink className="h-3.5 w-3.5" /> Otwórz na Allegro
                    </a>
                  )}
                </div>
                <div className="text-sm text-amber-900 space-y-1">
                  {meta.reason ? <div><span className="font-medium">Powód:</span> {String(meta.reason)}</div> : null}
                  {exps.length > 0 ? <div><span className="font-medium">Oczekiwanie klienta:</span> {exps.join(', ')}</div> : null}
                  {lines.length > 0 ? <div><span className="font-medium">Zamówienie:</span> {lines.join('; ')}{meta.order_delivery ? ` · ${String(meta.order_delivery)}` : ''}</div> : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-amber-700">
                    {meta.status ? <span>Status: {String(meta.status)}</span> : null}
                    {meta.decision_due ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Termin decyzji: {fmtFullDateTime(new Date(String(meta.decision_due)))}</span> : null}
                    {meta.right ? <span>Podstawa: {String(meta.right)}</span> : null}
                  </div>
                </div>
                <p className="text-[11px] text-amber-700/80">
                  Formalną decyzję (uznanie / odrzucenie / kwota zwrotu) podejmij na Allegro przez powyższy link.
                  Poniższy draft służy do odpowiedzi/rozmowy z klientem.
                </p>
              </div>
            )
          })()}

          {/* Historia wątku — załączniki pod każdą wiadomością klienta */}
          <div className="space-y-3">
            {msgRows.length === 0 && <div className="text-sm text-slate-400">Brak wiadomości.</div>}
            {msgRows.map(({ m, attachments, inboundId }, i) => {
              const role = ROLE_LABEL[m.role] ?? ROLE_LABEL.system
              return (
                <div key={i} className={`rounded-lg border p-4 ${role.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{role.label}</span>
                    <span className="text-[11px] opacity-60">{fmtFullDateTime(m.createdAt)}</span>
                  </div>
                  <MessageBody text={m.content} inboundId={m.role === 'user' ? inboundId : null} />
                  {attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <div className="text-[11px] font-semibold opacity-60 mb-1.5 inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> Załączniki
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((a, j) =>
                          a.downloadable ? (
                            <a
                              key={j}
                              href={`/api/email-attachment?inbound_id=${a.inboundId}&att_id=${encodeURIComponent(a.attId ?? '')}`}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                            >
                              <Download className="h-3.5 w-3.5 text-slate-500" />
                              {a.filename}
                              <span className="text-[11px] text-slate-400">{fmtBytes(a.size)}</span>
                            </a>
                          ) : (
                            <span key={j} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-400">
                              <Paperclip className="h-3.5 w-3.5" />
                              {a.filename}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {m.role === 'user' && inboundId && (
                    <div className="mt-2">
                      <ForwardButton inboundId={inboundId} conversationId={thread.id} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <EmailReplyPanel
            key={pendingDraft?.id ?? 'no-draft'}
            conversationId={thread.id}
            draft={
              pendingDraft
                ? {
                    id: pendingDraft.id,
                    subject: pendingDraft.subject,
                    bodyText: pendingDraft.bodyText ?? '',
                    origin: pendingDraft.origin,
                    escalated: pendingDraft.escalated,
                    toAddress: pendingDraft.toAddress,
                    ccAddresses: pendingDraft.ccAddresses,
                    mailboxAddress: pendingDraft.mailboxAddress,
                    attachments: pendingDraft.attachments,
                  }
                : null
            }
          />
        </div>

        {/* Sidebar — zamówienia klienta */}
        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5 mb-3">
              <ShoppingCart className="h-4 w-4 text-slate-500" /> Zamówienia klienta
            </div>
            {orders.length === 0 ? (
              <p className="text-xs text-slate-400">Brak zamówień powiązanych z tym adresem e-mail.</p>
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => {
                  // Realny URL śledzenia bierzemy z żywego statusu przesyłki (BaseLinker
                  // getOrderPackages), bo orders_cache.tracking_url bywa puste.
                  // Fallback: cache (o.trackingHref = tracking_url z DB > mapa kurierów).
                  const trackUrl = shipMap.get(o.extId)?.trackingUrl ?? o.trackingHref ?? null
                  return (
                  <li key={o.extId} className="text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      {/* Link do zamówienia w systemie źródłowym (BaseLinker / wp-admin WC);
                          nieznane źródło → numer bez linku */}
                      {o.adminUrl ? (
                        <a
                          href={o.adminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-indigo-600 hover:underline"
                          title="Otwórz zamówienie w systemie sklepu"
                        >
                          #{o.shopOrderId ?? o.extId}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-700">#{o.shopOrderId ?? o.extId}</span>
                      )}
                      {o.total != null && (
                        <span className="text-slate-700">{o.total.toFixed(2)} {o.currency ?? 'PLN'}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {o.status ?? '—'}
                      </span>
                      {o.dateAdd && <span className="text-[11px] text-slate-400">{fmtDateShort(o.dateAdd)}</span>}
                    </div>
                    {(() => {
                      const s = shipMap.get(o.extId)
                      return s ? (
                        <div className="mt-1.5">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${shipBadge(s.kind)}`}>
                            <Truck className="h-3 w-3" /> Przesyłka: {s.status}
                            {s.statusDate ? ` · ${s.statusDate}` : ''}
                          </span>
                        </div>
                      ) : null
                    })()}
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {o.itemCount != null && <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{o.itemCount} poz.</span>}
                      {o.deliveryMethod && <span>{o.deliveryMethod}</span>}
                      {o.paymentMethod && <span>{o.paymentMethod}</span>}
                    </div>
                    {o.trackingNumber && (
                      trackUrl ? (
                        <a
                          href={trackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-600 hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          <Truck className="h-3 w-3" /> {o.trackingNumber}
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {o.trackingNumber}
                        </span>
                      )
                    )}
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
