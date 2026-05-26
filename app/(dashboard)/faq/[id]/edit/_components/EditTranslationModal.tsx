'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateTranslation, type ActionResult } from '@/actions/faq'
import type { TranslationRow } from '@/queries/faq'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  translation: TranslationRow
  langLabel: string
}

export function EditTranslationModal({ open, onOpenChange, translation, langLabel }: Props) {
  const router = useRouter()
  const action = updateTranslation.bind(null, translation.id)
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edytuj tłumaczenie — {langLabel}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 mt-2">
          {state.message && (
            <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {state.message}
            </div>
          )}

          <div>
            <Label className="text-xs font-medium block mb-1.5">Pytanie</Label>
            <Input name="question" defaultValue={translation.question} required maxLength={500} />
          </div>

          <div>
            <Label className="text-xs font-medium block mb-1.5">Odpowiedź (pełna, do kanałów tekstowych)</Label>
            <Textarea name="answer" defaultValue={translation.answer} required rows={5} maxLength={5000} />
          </div>

          <div>
            <Label className="text-xs font-medium block mb-1.5">Odpowiedź głosowa (max 2 zdania)</Label>
            <Textarea
              name="answerVoice"
              defaultValue={translation.answerVoice ?? ''}
              rows={2}
              maxLength={500}
              placeholder="(opcjonalne)"
            />
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Ta zmiana oznaczy tłumaczenie jako <strong>ręcznie edytowane</strong>. Przy kolejnym zapisie
            polskiego mastera ta wersja NIE zostanie nadpisana automatycznie. Użyj „Regeneruj" jeśli chcesz
            wrócić do auto-generowanej.
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : 'Zapisz tłumaczenie'}
    </Button>
  )
}
