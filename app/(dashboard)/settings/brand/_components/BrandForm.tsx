'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/client'

type Initial = {
  botName: string
  botPersona: 'formal' | 'casual'
  primaryLanguage: 'pl' | 'en' | 'uk' | 'de'
}

export function BrandForm({ action, initial }: {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial: Initial
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <div className={`rounded-md border px-4 py-2.5 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      <div>
        <Label className="text-sm font-medium block mb-1.5">Imię bota</Label>
        <Input name="botName" defaultValue={initial.botName} required maxLength={50} />
        <p className="text-xs text-slate-500 mt-1">
          Tak bot się przedstawi: „Cześć, jestem [imię], asystent [nazwa obiektu/sklepu]".
        </p>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-1.5">Ton komunikacji</Label>
        <select name="botPersona" defaultValue={initial.botPersona}
          className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm bg-white">
          <option value="formal">Formalny („Pan/Pani")</option>
          <option value="casual">Luźny („cześć, na ty")</option>
        </select>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-1.5">Język główny</Label>
        <select name="primaryLanguage" defaultValue={initial.primaryLanguage}
          className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm bg-white">
          <option value="pl">Polski</option>
          <option value="en">English</option>
          <option value="uk">Українська</option>
          <option value="de">Deutsch</option>
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Bot rozpoznaje język gościa automatycznie, ale ten jest fallbackiem.
        </p>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : 'Zapisz'}
    </Button>
  )
}
