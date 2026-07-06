'use client'

import { useState, useTransition } from 'react'
import { Forward, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { forwardInbound } from '@/actions/email'

/**
 * Przekazanie maila klienta na inny adres (magazyn / księgowość / B2B).
 * Oryginalna treść + załączniki idą z tej samej skrzynki; w konwersacji
 * zostaje wpis systemowy (audyt).
 */
export function ForwardButton({
  inboundId,
  conversationId,
}: {
  inboundId: string
  conversationId: string
}) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () =>
    startTransition(async () => {
      const res = await forwardInbound(inboundId, conversationId, to, note)
      if (res.ok) {
        toast.success(res.message)
        setOpen(false)
        setTo('')
        setNote('')
      } else {
        toast.error(res.message)
      }
    })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700"
        title="Przekaż tę wiadomość na inny adres e-mail"
      >
        <Forward className="h-3 w-3" />
        Przekaż
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-600 inline-flex items-center gap-1">
          <Forward className="h-3 w-3" /> Przekaż wiadomość (z załącznikami)
        </span>
        <button onClick={() => setOpen(false)} disabled={pending} className="text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="adres@docelowy.pl"
        autoFocus
        className="w-full h-8 px-2.5 rounded border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notatka dla odbiorcy (opcjonalnie, trafi nad przekazaną treścią)"
        rows={2}
        className="w-full px-2.5 py-1.5 rounded border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          disabled={pending}
          className="h-8 px-2.5 rounded border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50"
        >
          Anuluj
        </button>
        <button
          onClick={submit}
          disabled={pending || !to.trim()}
          className="h-8 px-3 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Forward className="h-3.5 w-3.5" />}
          Przekaż
        </button>
      </div>
    </div>
  )
}
