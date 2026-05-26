'use client'

import { Trash2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/actions/client'

type Props = {
  id: string
  name: string
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
}

export function DeleteRecipientButton({ id, name, action }: Props) {
  // Opakuj server action w void-returning wrapper dla <form action={...}>
  const wrappedAction = async (fd: FormData) => {
    await action({ ok: false }, fd)
  }

  return (
    <form
      action={wrappedAction}
      onSubmit={(e) => {
        if (!confirm(`Usunąć odbiorcę "${name}"?`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteButton />
    </form>
  )
}

function DeleteButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
