'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { resolveEscalation, type ActionResult } from '@/actions/escalations'

export function ResolveDialog({ open, onOpenChange, escalationId }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  escalationId: string
}) {
  const router = useRouter()
  const action = resolveEscalation.bind(null, escalationId)
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd)
      if (res.ok) {
        onOpenChange(false)
        router.refresh()
      }
      return res
    },
    { ok: false },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rozwiąż eskalację</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3 mt-2">
          {state.message && !state.ok && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          )}

          <div>
            <label className="text-xs font-medium block mb-1">
              Notatka (opcjonalne)
            </label>
            <Textarea
              name="note"
              rows={3}
              maxLength={1000}
              placeholder="np. „Zadzwoniłem do gościa, kod do drzwi działa po restarcie smartlocka"
            />
            <p className="text-xs text-slate-500 mt-1">
              Notatka zostanie zapisana w historii rozmowy.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <SubmitBtn />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Zapisywanie...' : 'Rozwiąż'}</Button>
}
