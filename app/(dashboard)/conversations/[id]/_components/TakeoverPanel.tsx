'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Headset, Bot, Send, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  takeoverConversation,
  releaseConversation,
  replyInConversation,
} from '@/actions/conversations'

/**
 * Przejęcie rozmowy przez człowieka.
 * - Przejęta → bot milczy (gate w backendzie), odpowiada zalogowany user.
 * - Odpowiadanie z panelu działa dla webchatu (dostarczanie przez polling
 *   widgetu); dla innych kanałów przejęcie tylko wycisza bota.
 * - Eskalowana rozmowa webchat bez przejęcia → wyraźny baner CTA.
 */
export function TakeoverPanel({
  id,
  channel,
  status,
  takenOverBy,
}: {
  id: string
  channel: string
  status: string
  takenOverBy: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError(null)
      const res = await fn()
      if (!res.ok) setError(res.message ?? 'Coś poszło nie tak.')
      router.refresh()
    })

  const onSend = () => {
    const value = text.trim()
    if (!value) return
    run(async () => {
      const res = await replyInConversation(id, value)
      if (res.ok) setText('')
      return res
    })
  }

  if (!takenOverBy) {
    const showEscalationBanner = status === 'escalated' && channel === 'webchat'
    return (
      <div
        className={`rounded-lg border p-4 flex items-center justify-between gap-4 flex-wrap ${
          showEscalationBanner ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="text-sm">
          {showEscalationBanner ? (
            <span className="flex items-center gap-2 text-red-700 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Sprawa eskalowana — klient czeka na człowieka. Przejmij rozmowę i odpisz na czacie.
            </span>
          ) : (
            <span className="text-slate-600">
              Rozmowę prowadzi bot. Przejmij ją, żeby odpisywać samodzielnie — bot przestanie odpowiadać.
            </span>
          )}
        </div>
        <Button variant={showEscalationBanner ? 'default' : 'outline'} onClick={() => run(() => takeoverConversation(id))} disabled={pending} className="gap-1.5">
          <Headset className="h-4 w-4" />
          {pending ? 'Przejmowanie…' : 'Przejmij rozmowę'}
        </Button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Headset className="h-4 w-4" />
          Rozmowa przejęta przez: {takenOverBy} — bot nie odpowiada.
        </span>
        <Button variant="outline" size="sm" onClick={() => run(() => releaseConversation(id))} disabled={pending} className="gap-1.5">
          <Bot className="h-4 w-4" />
          {pending ? 'Oddawanie…' : 'Oddaj botowi'}
        </Button>
      </div>

      {channel === 'webchat' ? (
        <div className="flex gap-2 items-end">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            rows={2}
            placeholder="Napisz odpowiedź do klienta… (Enter = wyślij, Shift+Enter = nowa linia)"
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-y"
          />
          <Button onClick={onSend} disabled={pending || !text.trim()} className="gap-1.5">
            <Send className="h-4 w-4" />
            {pending ? 'Wysyłanie…' : 'Wyślij'}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Kanał {channel} — bot jest wyciszony, ale odpowiedz klientowi bezpośrednio w tym kanale
          (odpowiadanie z panelu działa na razie tylko dla webchatu).
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-emerald-700/70">
        Klient widzi odpowiedzi w okienku czatu na stronie (odświeżanie do ~5 s).
      </p>
    </div>
  )
}
