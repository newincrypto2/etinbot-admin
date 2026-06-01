import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, User, Inbox } from 'lucide-react'

import { getEmailThread } from '@/queries/email'
import { fmtDateTimeSec } from '@/lib/datetime'
import { EmailReplyPanel } from './_components/EmailReplyPanel'

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  user: { label: 'Klient', color: 'bg-blue-50 border-blue-200 text-blue-900' },
  assistant: { label: 'Wysłane', color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  tool: { label: 'Tool', color: 'bg-amber-50 border-amber-200 text-amber-900' },
  system: { label: 'System', color: 'bg-slate-50 border-slate-200 text-slate-700' },
}

export default async function PocztaThreadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const thread = await getEmailThread(id)
  if (!thread) notFound()

  // Najnowszy draft o statusie 'draft' (czeka na akcję); jak brak — null.
  const pendingDraft = [...thread.drafts].reverse().find((d) => d.status === 'draft') ?? null

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/poczta" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do poczty
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          {thread.guestName ?? thread.guestEmail ?? 'Wątek'}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 flex-wrap">
          <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{thread.guestEmail ?? '—'}</span>
          <span className="inline-flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" />na {thread.inboxAddress ?? '—'}</span>
        </div>
      </header>

      {/* Historia wątku */}
      <div className="space-y-3">
        {thread.messages.length === 0 && (
          <div className="text-sm text-slate-400">Brak wiadomości.</div>
        )}
        {thread.messages.map((m, i) => {
          const role = ROLE_LABEL[m.role] ?? ROLE_LABEL.system
          if (m.role === 'tool') return null
          return (
            <div key={i} className={`rounded-lg border p-4 ${role.color}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{role.label}</span>
                <span className="text-[11px] opacity-60">{fmtDateTimeSec(m.createdAt)}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          )
        })}
      </div>

      {/* Panel odpowiedzi */}
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
              }
            : null
        }
      />
    </div>
  )
}
