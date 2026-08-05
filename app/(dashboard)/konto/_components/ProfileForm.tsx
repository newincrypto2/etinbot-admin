'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateOwnName, type ActionResult } from '@/actions/users'

export function ProfileForm({ initialName }: { initialName: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(updateOwnName, { ok: false })

  return (
    <form action={formAction} className="space-y-4">
      {state.message && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            state.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {state.message}
        </div>
      )}

      <div>
        <Label className="text-xs font-medium block mb-1">Imię i nazwisko</Label>
        <Input name="name" defaultValue={initialName} required minLength={2} maxLength={100} />
        <p className="text-xs text-slate-500 mt-1.5">
          Widoczne w panelu i jako podpis pod wysyłanymi mailami.
        </p>
      </div>

      <SubmitBtn />
    </form>
  )
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : 'Zapisz'}
    </Button>
  )
}
