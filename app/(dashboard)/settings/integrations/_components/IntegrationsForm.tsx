'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/client'

export function IntegrationsForm({ action, initial }: {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial: {
    idobookingTenant: string
    idobookingLogin: string
    elevenlabsAgentId: string
    hasIdobookingApiKey: boolean
    hasElevenlabsAgent: boolean
  }
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className={`rounded-md border px-4 py-2.5 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">IdoBooking / IdoSell</legend>

        <div>
          <Label className="text-xs font-medium block mb-1">Tenant (subdomena IdoSell)</Label>
          <Input name="idobookingTenant" defaultValue={initial.idobookingTenant} placeholder="np. client1679" />
          <p className="text-xs text-slate-500 mt-1">
            Endpoint API: <code className="font-mono text-slate-700">https://[tenant].idosell.com/api/…</code>
          </p>
        </div>

        <div>
          <Label className="text-xs font-medium block mb-1">systemLogin</Label>
          <Input name="idobookingLogin" defaultValue={initial.idobookingLogin} placeholder="np. api_user" />
        </div>

        <div>
          <Label className="text-xs font-medium block mb-1">
            API key {initial.hasIdobookingApiKey && <span className="text-emerald-600 font-normal">✓ ustawiony</span>}
          </Label>
          <Input
            name="idobookingApiKey"
            type="password"
            placeholder={initial.hasIdobookingApiKey ? '••••• zostaw puste żeby nie zmieniać' : 'wpisz klucz API'}
          />
          <p className="text-xs text-slate-500 mt-1">
            Wygeneruj w panelu IdoBooking → Developer. Zapisujemy w DB (TODO: szyfrowanie at-rest w Sprint 2).
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">ElevenLabs (voice bot)</legend>

        <div>
          <Label className="text-xs font-medium block mb-1">
            Agent ID {initial.hasElevenlabsAgent && <span className="text-emerald-600 font-normal">✓ podpięty</span>}
          </Label>
          <Input
            name="elevenlabsAgentId"
            defaultValue={initial.elevenlabsAgentId}
            placeholder="np. agent_abc123"
          />
          <p className="text-xs text-slate-500 mt-1">
            Identyfikator agenta Conversational AI w ElevenLabs. Bot głosowy używa go żeby zawołać <code className="font-mono">/api/kb/search</code>.
          </p>
        </div>
      </fieldset>

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
