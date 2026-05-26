'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/client'

type Props = {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  scope: 'silver-place' | 'silver-forest'
  initial: {
    tenant: string
    systemLogin: string
    hasPassword: boolean
    isActive: boolean
  }
}

export function IdobookingForm({ action, scope, initial }: Props) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="scope" value={scope} />

      {state.message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium block mb-1">Tenant (subdomena)</Label>
          <Input name="tenant" defaultValue={initial.tenant} placeholder="np. client20384" required />
          <p className="text-xs text-slate-500 mt-1">
            Z URL panelu: <code className="font-mono">https://[tenant].idobooking.com/</code>
          </p>
        </div>

        <div>
          <Label className="text-xs font-medium block mb-1">systemLogin</Label>
          <Input name="systemLogin" defaultValue={initial.systemLogin} placeholder="np. api_client20384" required />
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium block mb-1">
          Hasło użytkownika panelu {initial.hasPassword && <span className="text-emerald-600 font-normal">✓ ustawione</span>}
        </Label>
        <Input
          name="apiPassword"
          type="password"
          placeholder={initial.hasPassword ? '••••• zostaw puste żeby nie zmieniać' : 'hasło tego usera w panelu IdoBooking'}
        />
        <p className="text-xs text-slate-500 mt-1">
          To samo hasło którym user loguje się do panelu IdoBooking (NIE osobny "API key").
          Klucz auth rotuje codziennie automatycznie (sha1 z hasłem + datą).
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial.isActive}
            className="h-4 w-4"
          />
          <span>Aktywne (bot używa tych credentials)</span>
        </label>
        <SubmitButton />
      </div>
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
