'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TestIntegrationButton } from '@/components/TestIntegrationButton'
import type { ActionResult } from '@/actions/client'
import type { IntegrationSource, MessengerPageSummary } from '@/queries/client'

type Props = {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  slug: string
  initial: {
    baselinkerTokenSet: boolean
    baselinkerSource: IntegrationSource
    wcUrl: string | null
    wcKeySet: boolean
    wcSecretSet: boolean
    wcSource: IntegrationSource
    twilioSmsNumber: string | null
    twilioSource: IntegrationSource
    messengerPageId: string | null
    messengerTokenSet: boolean
    messengerAppSecretSet: boolean
    messengerSource: IntegrationSource
    messengerPages: MessengerPageSummary[]
  }
}

/** Badge prawdziwego źródła konfiguracji — koniec pustych pól, które w
 *  rzeczywistości działają z env Coolify (audyt 08.2026). */
function SourceBadge({ source }: { source: IntegrationSource }) {
  if (source === 'panel') {
    return <span className="text-xs text-emerald-600 font-medium">✓ skonfigurowane (panel)</span>
  }
  if (source === 'env') {
    return <span className="text-xs text-emerald-600 font-medium">✓ skonfigurowane (env Coolify)</span>
  }
  return <span className="text-xs text-slate-400">— nieskonfigurowane</span>
}

export function EcommerceIntegrationsForm({ action, slug, initial }: Props) {
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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h3 className="font-medium text-slate-900">BaseLinker</h3>
          <div className="flex items-center gap-2">
            <SourceBadge source={initial.baselinkerSource} />
            <TestIntegrationButton slug={slug} integration="baselinker" />
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Źródło zamówień. Token z BaseLinker → Moje konto → API.
        </p>
        <Label className="text-xs font-medium block mb-1">
          API token {initial.baselinkerTokenSet && <span className="text-emerald-600 font-normal">✓ ustawiony w panelu</span>}
        </Label>
        <Input
          name="baselinkerToken"
          type="password"
          placeholder={initial.baselinkerTokenSet ? '••••• zostaw puste żeby nie zmieniać' : 'token API BaseLinker (może być w env backendu)'}
        />
      </div>

      {/* WooCommerce */}
      <div className="rounded-lg border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium text-slate-900">WooCommerce</h3>
          <div className="flex items-center gap-2">
            <SourceBadge source={initial.wcSource} />
            <TestIntegrationButton slug={slug} integration="woocommerce" />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Źródło produktów (REST API v3). Klucze z WooCommerce → Ustawienia → Zaawansowane → REST API.
        </p>

        <div>
          <Label className="text-xs font-medium block mb-1">URL sklepu</Label>
          <Input name="wcUrl" type="url" defaultValue={initial.wcUrl ?? ''} placeholder="https://krainaherbaty.pl" />
          {initial.wcUrl && (
            <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" name="wcUrlClear" className="h-3 w-3" />
              Wyczyść URL (jeśli zostawisz pole puste bez zaznaczenia, wartość zostaje bez zmian)
            </label>
          )}
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
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs font-medium">Numer SMS (Twilio, na który piszą klienci)</Label>
            <SourceBadge source={initial.twilioSource} />
          </div>
          <Input name="twilioSmsNumber" defaultValue={initial.twilioSmsNumber ?? ''} placeholder="+48..." />
          {initial.twilioSmsNumber && (
            <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" name="twilioSmsNumberClear" className="h-3 w-3" />
              Wyczyść numer (puste pole bez zaznaczenia = bez zmian)
            </label>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-700">Messenger</h4>
          <div className="flex items-center gap-2">
            <SourceBadge source={initial.messengerSource} />
            {(initial.messengerPages.length > 0 || Boolean(initial.messengerPageId)) && (
              <TestIntegrationButton slug={slug} integration="messenger" />
            )}
          </div>
        </div>

        {initial.messengerPages.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              {initial.messengerPages.length} {initial.messengerPages.length === 1 ? 'strona spięta' : 'stron spiętych'} z tenantem
              (multi-page — tak działa produkcja). Edycja stron: Superadmin, karta klienta.
            </p>
            <div className="rounded-md border border-slate-200 divide-y">
              {initial.messengerPages.map((p, i) => (
                <div key={p.pageId || i} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono text-slate-800 truncate">{p.pageId || '(brak page_id)'}</div>
                    {p.brandContext && <div className="text-slate-500 truncate">{p.brandContext}</div>}
                  </div>
                  <div className="text-slate-400 font-mono shrink-0">{p.tokenMasked ?? 'brak tokenu'}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Brak stron spiętych — poniższy formularz doda pierwszą (legacy, pojedyncza strona).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium block mb-1">Page ID</Label>
                <Input name="messengerPageId" defaultValue={initial.messengerPageId ?? ''} placeholder="np. 1234567890" />
                {initial.messengerPageId && (
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <input type="checkbox" name="messengerPageIdClear" className="h-3 w-3" />
                    Wyczyść (puste pole bez zaznaczenia = bez zmian)
                  </label>
                )}
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">
                  Page Token {initial.messengerTokenSet && <span className="text-emerald-600 font-normal">✓</span>}
                </Label>
                <Input name="messengerPageToken" type="password" placeholder={initial.messengerTokenSet ? '••••• zostaw puste' : 'EAAB...'} />
              </div>
              <div>
                <Label className="text-xs font-medium block mb-1">
                  App Secret {initial.messengerAppSecretSet && <span className="text-emerald-600 font-normal">✓</span>}
                </Label>
                <Input name="messengerAppSecret" type="password" placeholder={initial.messengerAppSecretSet ? '••••• zostaw puste' : 'app secret'} />
              </div>
            </div>
          </div>
        )}
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
