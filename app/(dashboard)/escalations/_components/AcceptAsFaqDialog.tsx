'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { BookPlus } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { acceptEscalationAsFaq, type ActionResult } from '@/actions/escalations'
import type { BuildingOption } from '@/lib/building-format'

export function AcceptAsFaqDialog({
  open,
  onOpenChange,
  escalationId,
  suggestedQuestion,
  vertical = 'rental',
  buildings = [],
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  escalationId: string
  suggestedQuestion: string
  vertical?: 'rental' | 'ecommerce'
  buildings?: BuildingOption[]
}) {
  const router = useRouter()
  const action = acceptEscalationAsFaq.bind(null, escalationId)
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
          <DialogTitle className="flex items-center gap-2">
            <BookPlus className="h-5 w-5 text-indigo-600" />
            Akceptuj jako nowe FAQ
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 mt-2">
          {state.message && !state.ok && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          )}

          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            Tworzysz nowe pytanie w FAQ na podstawie tej eskalacji. Bot będzie potrafił odpowiadać
            na takie pytania w przyszłości. Tłumaczenia EN/UA/DE wygenerują się automatycznie.
          </div>

          <div>
            <Label className="text-xs font-medium block mb-1">Pytanie (po polsku)</Label>
            <Input name="question" defaultValue={suggestedQuestion} required maxLength={500}
              placeholder={vertical === 'ecommerce' ? 'np. Ile trwa dostawa?' : 'np. Czy mogę przyjechać z psem?'} />
            <p className="text-xs text-slate-500 mt-1">
              Wstępna treść z wiadomości {vertical === 'ecommerce' ? 'klienta' : 'gościa'} — popraw jeśli trzeba.
            </p>
            {state.errors?.question && <p className="text-xs text-red-600 mt-1">{state.errors.question}</p>}
          </div>

          <div>
            <Label className="text-xs font-medium block mb-1">Odpowiedź (po polsku)</Label>
            <Textarea name="answer" rows={5} required maxLength={5000}
              placeholder="Wpisz poprawną odpowiedź którą bot powinien dawać na takie pytania" />
            {state.errors?.answer && <p className="text-xs text-red-600 mt-1">{state.errors.answer}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium block mb-1">Kategoria</Label>
              <Input name="category" required maxLength={50} placeholder={vertical === 'ecommerce' ? 'np. dostawa, zwroty' : 'np. zwierzęta'} />
              {state.errors?.category && <p className="text-xs text-red-600 mt-1">{state.errors.category}</p>}
            </div>
            {vertical === 'ecommerce' ? (
              <input type="hidden" name="scope" value="both" />
            ) : (
              <div>
                <Label className="text-xs font-medium block mb-1">Budynek (scope)</Label>
                <select name="scope" defaultValue="both"
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm bg-white">
                  <option value="both">Wszystkie budynki</option>
                  {buildings.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                </select>
              </div>
            )}
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
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Tworzenie FAQ...' : 'Utwórz FAQ + rozwiąż eskalację'}
    </Button>
  )
}
