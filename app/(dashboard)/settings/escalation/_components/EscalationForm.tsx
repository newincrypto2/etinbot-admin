'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/client'

export function EscalationForm({ action, initial }: {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial: { escalationPhoneOffice: string; escalationPhoneSecurity: string; escalationEmail: string }
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
        <Label className="text-sm font-medium block mb-1.5">Numer biura (godz. 8-16)</Label>
        <Input name="escalationPhoneOffice" defaultValue={initial.escalationPhoneOffice} placeholder="+48918171617" />
        <p className="text-xs text-slate-500 mt-1">
          Bot proponuje gościowi ten numer dla spraw normalnych (modyfikacje, faktury, info).
        </p>
        {state.errors?.escalationPhoneOffice && <p className="text-xs text-red-600 mt-1">{state.errors.escalationPhoneOffice}</p>}
      </div>

      <div>
        <Label className="text-sm font-medium block mb-1.5">Numer alarmowy 24/7</Label>
        <Input name="escalationPhoneSecurity" defaultValue={initial.escalationPhoneSecurity} placeholder="+48780060674" />
        <p className="text-xs text-slate-500 mt-1">
          Bot eskaluje TU sprawy pilne: awarie, brak wejścia po godzinach, sytuacje krytyczne.
        </p>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-1.5">Email kontaktowy</Label>
        <Input name="escalationEmail" type="email" defaultValue={initial.escalationEmail} placeholder="biuro@matysproperty.pl" />
        <p className="text-xs text-slate-500 mt-1">
          Email do podania w wiadomościach dla gościa (poza Booking.com, gdzie blokują adresy).
        </p>
        {state.errors?.escalationEmail && <p className="text-xs text-red-600 mt-1">{state.errors.escalationEmail}</p>}
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
