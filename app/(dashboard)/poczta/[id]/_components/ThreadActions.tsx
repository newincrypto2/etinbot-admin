'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RotateCcw, Briefcase, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { setEmailThreadClosed, tagEmailThreadB2B, markEmailThreadSpam } from '@/actions/email'

export function ThreadActions({
  id,
  status,
  tags,
}: {
  id: string
  status: string
  tags: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const closed = status === 'closed'
  const isB2B = tags?.includes('b2b')

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
      router.refresh()
    })

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => setEmailThreadClosed(id, !closed))}
        className="gap-1.5"
      >
        {closed ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {closed ? 'Otwórz ponownie' : 'Zamknij'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || isB2B}
        onClick={() => run(() => tagEmailThreadB2B(id))}
        className={`gap-1.5 ${isB2B ? 'text-indigo-600 border-indigo-200 bg-indigo-50' : ''}`}
      >
        <Briefcase className="h-4 w-4" />
        {isB2B ? 'B2B / hurt ✓' : 'B2B / hurt'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm('Oznaczyć wątek jako spam i zamknąć?')) run(() => markEmailThreadSpam(id))
        }}
        className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
      >
        <ShieldAlert className="h-4 w-4" />
        Spam
      </Button>
    </div>
  )
}
