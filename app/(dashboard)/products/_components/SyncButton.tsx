'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

import { triggerProductSync } from '@/actions/products'

export function SyncButton() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const router = useRouter()

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {msg.text}
          {msg.ok && (
            <button
              type="button"
              onClick={() => router.refresh()}
              className="ml-2 underline hover:no-underline"
            >
              Odśwież
            </button>
          )}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null)
            const r = await triggerProductSync()
            setMsg({ ok: r.ok, text: r.message })
          })
        }
        className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Synchronizuję…' : 'Synchronizuj z WooCommerce'}
      </button>
    </div>
  )
}
