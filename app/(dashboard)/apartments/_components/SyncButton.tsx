'use client'

import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { syncFromIdoBooking } from '@/actions/apartments'

export function SyncButton() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const onClick = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await syncFromIdoBooking()
      setMessage({ text: res.message ?? (res.ok ? 'Zsynchronizowano' : 'Błąd'), ok: res.ok })
    })
  }

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={pending} variant="outline" className="gap-1.5">
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Synchronizuję...' : 'Synchronizuj z IdoBooking'}
      </Button>
      {message && (
        <div className={`text-xs px-3 py-2 rounded ${message.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
