'use client'

import { useState, useTransition } from 'react'
import { CheckCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { resolveAllUnresolved } from '@/actions/escalations'

/**
 * Zbiorcze rozwiązanie wszystkich nierozwiązanych eskalacji (z aktywnym filtrem
 * przyczyny). Dwuetapowe potwierdzenie zamiast window.confirm (nie blokuje
 * automatyzacji przeglądarki i wygląda spójnie).
 */
export function ResolveAllButton({ reason, count }: { reason: string; count: number }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (count === 0) return null

  const run = () =>
    startTransition(async () => {
      const res = await resolveAllUnresolved(reason)
      if (res.ok) toast.success(res.message ?? 'Rozwiązano')
      else toast.error(res.message ?? 'Błąd')
      setConfirming(false)
    })

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600">Rozwiązać {count} eskalacji?</span>
        <button
          onClick={run}
          disabled={pending}
          className="h-9 px-3 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          Tak, rozwiąż
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="h-9 px-3 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
        >
          Anuluj
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="h-9 px-3 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
    >
      <CheckCheck className="h-4 w-4" />
      Rozwiąż wszystkie ({count})
    </button>
  )
}
