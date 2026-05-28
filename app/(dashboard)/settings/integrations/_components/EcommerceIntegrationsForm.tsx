'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/client'

type Props = {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial: {
    baselinkerTokenSet: boolean
    wcUrl: string | null
    wcKeySet: boolean
    wcSecretSet: boolean
    twilioSmsNumber: string | null
    messengerPageId: string | null
    messengerTokenSet: boolean
    messengerAppSecretSet: boolean
  }
}

export function EcommerceIntegrationsForm({ action, initial }: Props) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      {/* BaseLinker */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900 mb-1">BaseLinker</h3>
        <p className="text-xs text-slate-500 mb-3">
          Źródło zamówień. Token z BaseLinker → Moje konto → API.
        </p>
        <Label className="text-xs font-medium block mb-1">
          API token {initial.baselinkerTokenSet && <span className="text-emerald-600 font-normal">✓ ustawiony</span>}
        </Label>
        <Input
          name="baselinkerToken"
          type="password"
          placeholder={initial.baselinkerTokenSet ? '••••• zostaw puste żeby nie zmieniać' : 'token API BaseLinker'}
        />
      </div>

      {/* WooCommerce */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-3">
        <div>
          <h3 className="font-medium text-slate-900 mb-1">WooCommerce</h3>
          <p className="text-xs text-slate-500">
            Źródło produktów (REST API v3). Klucze z WooCommerce → Ustawienia → Zaawansowane → REST API.
          </p>
        </div>

        <div>
          <Label className="text-xs font-medium block mb-1">URL sklepu</Label>
          <Input name="wcUrl" type="url" defaultValue={initial.wcUrl ?? ''} placeholder="https://krainaherbaty.pl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium block mb-1">
              Consumer key {initial.wcKeySet && <span className="text-emerald-600 font-normal">✓</span>}
            </Label>
            <Input
              name="wcConsumerKey"
              type="password"
              placeholder={initial.wcKeySet ? '••••• zostaw puste' : 'ck_...'}
            />
          </div>
          <div>
            <Label className="text-xs font-medium block mb-1">
              Consumer secret {initial.wcSecretSet && <span className="text-emerald-600 font-normal">✓</span>}
            </Label>
            <Input
              name="wcConsumerSecret"
              type="password"
              placeholder={initial.wcSecretSet ? '••••• zostaw puste' : 'cs_...'}
            />
          </div>
        </div>
      </div>

      {/* Kanały tekstowe */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-3">
        <div>
          <h3 className="font-medium text-slate-900 mb-1">Kanały tekstowe (bot odpisuje klientom)</h3>
          <p className="text-xs text-slate-500">
            SMS przez Twilio i Messenger przez Facebooka. Webhooki:
            <code className="font-mono"> /webhook/twilio/sms</code> i <code className="font-mono">/webhook/messenger</code>.
          </p>
        </div>

        <div>
          <Label className="text-xs font-medium block mb-1">Numer SMS (Twilio, na który piszą klienci)</Label>
          <Input name="twilioSmsNumber" defaultValue={initial.twilioSmsNumber ?? ''} placeholder="+48..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium block mb-1">Messenger — Page ID</Label>
            <Input name="messengerPageId" defaultValue={initial.messengerPageId ?? ''} placeholder="np. 1234567890" />
          </div>
          <div>
            <Label className="text-xs font-medium block mb-1">
              Messenger — Page Token {initial.messengerTokenSet && <span className="text-emerald-600 font-normal">✓</span>}
            </Label>
            <Input name="messengerPageToken" type="password" placeholder={initial.messengerTokenSet ? '••••• zostaw puste' : 'EAAB...'} />
          </div>
          <div>
            <Label className="text-xs font-medium block mb-1">
              Messenger — App Secret {initial.messengerAppSecretSet && <span className="text-emerald-600 font-normal">✓</span>}
            </Label>
            <Input name="messengerAppSecret" type="password" placeholder={initial.messengerAppSecretSet ? '••••• zostaw puste' : 'app secret'} />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Verify token webhooka FB ustaw w env backendu jako <code className="font-mono">MESSENGER_VERIFY_TOKEN</code> (ten sam co w panelu FB).
        </p>
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : 'Zapisz integracje'}
    </Button>
  )
}
