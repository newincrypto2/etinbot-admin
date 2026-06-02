import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, User, Inbox, Paperclip, Download, ShoppingCart, Truck, Package, Briefcase } from 'lucide-react'

import { getEmailThread, getCustomerOrders } from '@/queries/email'
import { fmtFullDateTime, fmtDateShort } from '@/lib/datetime'
import { EmailReplyPanel } from './_components/EmailReplyPanel'
import { ThreadActions } from './_components/ThreadActions'

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

export default async function PocztaThreadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const thread = await getEmailThread(id)
  if (!thread) notFound()

  const orders = await getCustomerOrders(thread.clientId, thread.guestEmail)
  const pendingDraft = [...thread.drafts].reverse().find((d) => d.status === 'draft') ?? null

  // Załączniki per wiadomość — N-ta wiadomość 'user' = N-ty inbound (ta sama kolejność)
  let _ui = 0
  const msgRows = thread.messages
    .filter((m) => m.role !== 'tool')
    .map((m) => ({
      m,
      attachments: m.role === 'user' ? thread.inbounds[_ui++]?.attachments ?? [] : [],
    }))

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

          {/* Historia wątku — załączniki pod każdą wiadomością klienta */}
          <div className="space-y-3">
            {msgRows.length === 0 && <div className="text-sm text-slate-400">Brak wiadomości.</div>}
            {msgRows.map(({ m, attachments }, i) => {
              const role = ROLE_LABEL[m.role] ?? ROLE_LABEL.system
              return (
                <div key={i} className={`rounded-lg border p-4 ${role.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{role.label}</span>
                    <span className="text-[11px] opacity-60">{fmtFullDateTime(m.createdAt)}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
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
                {orders.map((o) => (
                  <li key={o.extId} className="text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <a
                        href={`https://panel.baselinker.com/orders.php#order:${o.extId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-600 hover:underline"
                        title="Otwórz w BaseLinker"
                      >
                        #{o.shopOrderId ?? o.extId}
                      </a>
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
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {o.itemCount != null && <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{o.itemCount} poz.</span>}
                      {o.deliveryMethod && <span>{o.deliveryMethod}</span>}
                      {o.paymentMethod && <span>{o.paymentMethod}</span>}
                    </div>
                    {o.trackingNumber && (
                      <a
                        href={o.trackingUrl ?? '#'}
                        target="_blank"
                        className="text-[11px] text-indigo-600 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        <Truck className="h-3 w-3" /> {o.trackingNumber}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
