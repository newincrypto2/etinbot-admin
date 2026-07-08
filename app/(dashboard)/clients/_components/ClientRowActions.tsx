'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { LogIn, ExternalLink, Power, Loader2 } from 'lucide-react'

import { setActiveTenant } from '@/actions/tenant'
import { setClientActive } from '@/actions/clients'

export function ClientRowActions({ slug, active }: { slug: string; active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  const doSwitch = () =>
    startTransition(async () => {
      const r = await setActiveTenant(slug)
      if (r.ok) {
        toast.success(r.message)
        router.push('/')
      } else {
        toast.error(r.message)
      }
    })

  const doToggle = () =>
    startTransition(async () => {
      const r = await setClientActive(slug, !active)
      if (r.ok) {
        toast.success(r.message)
        setConfirming(false)
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={doSwitch}
        disabled={pending}
        title="Przełącz panel na tego tenanta"
        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
        Przełącz
      </button>
      <Link
        href={`/clients/${slug}`}
        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Karta
      </Link>
      {confirming ? (
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={doToggle}
            disabled={pending}
            className={`h-8 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium text-white disabled:opacity-50 ${active ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {active ? 'Tak, dezaktywuj' : 'Tak, aktywuj'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="h-8 px-2 inline-flex items-center rounded-md border border-slate-300 text-xs text-slate-600 hover:bg-slate-50"
          >
            Anuluj
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title={active ? 'Dezaktywuj tenanta' : 'Aktywuj tenanta'}
          className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium ${active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
        >
          <Power className="h-3.5 w-3.5" />
          {active ? 'Dezaktywuj' : 'Aktywuj'}
        </button>
      )}
    </div>
  )
}
