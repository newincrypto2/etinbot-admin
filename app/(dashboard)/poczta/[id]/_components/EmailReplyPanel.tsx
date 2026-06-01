'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles, Trash2, AlertTriangle, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendDraft, wrapQuickReply, discardDraft } from '@/actions/email'

type Draft = {
  id: string
  subject: string
  bodyText: string
  origin: string
  escalated: boolean
  toAddress: string
  mailboxAddress: string
}

export function EmailReplyPanel({
  conversationId,
  draft,
}: {
  conversationId: string
  draft: Draft | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState(draft?.bodyText ?? '')
  const [core, setCore] = useState('')
  const [mode, setMode] = useState<'draft' | 'quick'>(draft ? 'draft' : 'quick')

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
      router.refresh()
    })

  const onSend = () => {
    if (!draft) return
    if (!confirm(`Wysłać odpowiedź do ${draft.toAddress} z adresu ${draft.mailboxAddress}?`)) return
    run(() => sendDraft(draft.id, conversationId, body))
  }
  const onDiscard = () => {
    if (!draft) return
    run(() => discardDraft(draft.id, conversationId))
  }
  const onWrap = () => run(() => wrapQuickReply(conversationId, core))

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <button
          onClick={() => setMode('draft')}
          disabled={!draft}
          className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
            mode === 'draft' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 disabled:opacity-40'
          }`}
        >
          Draft bota
        </button>
        <button
          onClick={() => setMode('quick')}
          className={`text-sm px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5 ${
            mode === 'quick' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Quick-reply
        </button>
      </div>

      {mode === 'draft' &&
        (draft ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-slate-500">
                Do: <span className="text-slate-800">{draft.toAddress}</span> · z:{' '}
                <span className="text-slate-800">{draft.mailboxAddress}</span>
              </div>
              <div className="flex items-center gap-2">
                {draft.origin === 'human_quick' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    z quick-reply
                  </span>
                )}
                {draft.escalated && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    bot niepewny — sprawdź
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-slate-500">
              Temat: <span className="text-slate-800">{draft.subject}</span>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="font-sans text-sm leading-relaxed"
              placeholder="Treść odpowiedzi…"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={onDiscard} disabled={pending} className="gap-1.5 text-slate-600">
                <Trash2 className="h-4 w-4" />
                Odrzuć
              </Button>
              <Button onClick={onSend} disabled={pending || !body.trim()} className="gap-1.5">
                <Send className="h-4 w-4" />
                {pending ? 'Wysyłanie…' : 'Zatwierdź i wyślij'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">
            Brak draftu do akceptacji. Użyj <strong>Quick-reply</strong>, by bot napisał odpowiedź z Twojego rdzenia.
          </div>
        ))}

      {mode === 'quick' && (
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600">
            Napisz <strong>rdzeń decyzji</strong> (np. „wyślemy nowe w miejsce uszkodzonych, przepraszamy
            za kłopot"). Bot doda powitanie po imieniu, ton marki i podpis.
          </p>
          <Textarea
            value={core}
            onChange={(e) => setCore(e.target.value)}
            rows={5}
            className="text-sm leading-relaxed"
            placeholder="Rdzeń odpowiedzi…"
          />
          <div className="flex justify-end">
            <Button onClick={onWrap} disabled={pending || !core.trim()} className="gap-1.5">
              <Wand2 className="h-4 w-4" />
              {pending ? 'Generuję…' : 'Wygeneruj draft'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
