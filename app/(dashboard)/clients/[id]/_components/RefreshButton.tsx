'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function RefreshButton({ label = 'Odśwież' }: { label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
      {label}
    </button>
  )
}
