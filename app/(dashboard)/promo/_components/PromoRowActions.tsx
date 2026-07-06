'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deletePromoBar, togglePromoBar } from '@/actions/promobar'

export function PromoRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [confirmDel, setConfirmDel] = useState(false)

  const toggle = () =>
    startTransition(async () => {
      const r = await togglePromoBar(id, !enabled)
      r.ok ? toast.success(r.message) : toast.error(r.message)
    })

  const del = () =>
    startTransition(async () => {
      const r = await deletePromoBar(id)
      r.ok ? toast.success(r.message) : toast.error(r.message)
      setConfirmDel(false)
    })

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
        title={enabled ? 'Wyłącz pasek' : 'Włącz pasek'}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <Link href={`/promo/${id}/edit`} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Edytuj">
        <Pencil className="h-4 w-4" />
      </Link>
      {confirmDel ? (
        <span className="inline-flex items-center gap-1">
          <button onClick={del} disabled={pending} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Usuń'}
          </button>
          <button onClick={() => setConfirmDel(false)} className="text-xs px-2 py-1 rounded border border-slate-200">Anuluj</button>
        </span>
      ) : (
        <button onClick={() => setConfirmDel(true)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Usuń kampanię">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
