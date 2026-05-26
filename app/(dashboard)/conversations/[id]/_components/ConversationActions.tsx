'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { closeConversation, reopenConversation } from '@/actions/conversations'

export function ConversationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const onClose = () => startTransition(async () => {
    await closeConversation(id)
    router.refresh()
  })

  const onReopen = () => startTransition(async () => {
    await reopenConversation(id)
    router.refresh()
  })

  if (status === 'closed') {
    return (
      <Button variant="outline" onClick={onReopen} disabled={pending} className="gap-1.5">
        <RotateCcw className="h-4 w-4" />
        {pending ? 'Otwieranie...' : 'Otwórz ponownie'}
      </Button>
    )
  }

  return (
    <Button variant="outline" onClick={onClose} disabled={pending} className="gap-1.5">
      <Check className="h-4 w-4" />
      {pending ? 'Zamykanie...' : 'Zamknij konwersację'}
    </Button>
  )
}
