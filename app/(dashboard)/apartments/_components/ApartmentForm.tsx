'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult, ApartmentInput } from '@/actions/apartments'
import type { BuildingOption } from '@/lib/building-format'

type Props = {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial?: Partial<ApartmentInput>
  submitLabel?: string
  buildings?: BuildingOption[]
}

const ACCESS_METHODS = [
  { value: '', label: '— wybierz —' },
  { value: 'smartlock', label: 'Smartlock (dynamiczny kod)' },
  { value: 'static_code', label: 'Stały kod' },
  { value: 'lockbox', label: 'Skrytka z kluczem' },
  { value: 'reception', label: 'Recepcja' },
]

const SMARTLOCKS = [
  { value: '', label: '— brak —' },
  { value: 'ttlock', label: 'TTLock' },
  { value: 'nuki', label: 'Nuki' },
  { value: 'yale', label: 'Yale' },
  { value: 'igloohome', label: 'igloohome' },
  { value: 'other', label: 'Inne' },
]

export function ApartmentForm({ action, initial = {}, submitLabel = 'Zapisz', buildings = [] }: Props) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })

  return (
    <form action={formAction} className="space-y-6">
      {state.message && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <Section title="Podstawowe">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nazwa apartamentu" error={state.errors?.name}>
            <Input name="name" defaultValue={initial.name ?? ''} required placeholder="np. A12" />
          </Field>
          <Field label="Budynek (kod)" error={state.errors?.buildingCode}>
            <Input name="buildingCode" defaultValue={initial.buildingCode ?? buildings[0]?.code ?? ''}
              required list="building-codes" placeholder="np. budynek-a (małe litery i myślniki)" />
            <datalist id="building-codes">
              {buildings.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
            </datalist>
            <p className="text-xs text-slate-500 mt-1">
              Wybierz istniejący budynek albo wpisz nowy kod — budynki powstają właśnie tutaj.
            </p>
          </Field>

          <Field label="Adres">
            <Input name="address" defaultValue={initial.address ?? ''} placeholder="ul. Przykładowa 1" />
          </Field>
          <Field label="Klatka / wejście">
            <Input name="entranceCode" defaultValue={initial.entranceCode ?? ''} placeholder="np. klatka 4" />
          </Field>

          <Field label="Piętro">
            <Input name="floor" type="number" min={-2} max={20} defaultValue={initial.floor ?? ''} />
          </Field>
          <Field label="Maks. gości">
            <Input name="maxGuests" type="number" min={1} max={20} defaultValue={initial.maxGuests ?? ''} />
          </Field>
        </div>
      </Section>

      <Section title="Dostęp / smartlock">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Sposób wejścia">
            <select name="accessMethod" defaultValue={initial.accessMethod ?? ''}
              className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm bg-white">
              {ACCESS_METHODS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          <Field label="Producent smartlocka">
            <select name="smartlockProvider" defaultValue={initial.smartlockProvider ?? ''}
              className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm bg-white">
              {SMARTLOCKS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Stały kod (fallback gdy brak smartlocka)">
            <Input name="staticAccessCode" defaultValue={initial.staticAccessCode ?? ''} placeholder="np. 1234" />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Jeśli smartlock spięty z IdoBooking, bot pobiera kod dynamicznie przez API <code className="font-mono">Locks.get</code> — stały kod nie jest potrzebny.
        </p>
      </Section>

      <Section title="WiFi">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="SSID">
            <Input name="wifiSsid" defaultValue={initial.wifiSsid ?? ''} placeholder="np. NazwaSieci" />
          </Field>
          <Field label="Hasło">
            <Input name="wifiPassword" defaultValue={initial.wifiPassword ?? ''} placeholder="np. haslo-wifi" />
          </Field>
        </div>
      </Section>

      <Section title="Parking">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="parkingAvailable" defaultChecked={initial.parkingAvailable ?? false} className="h-4 w-4" />
          <span>Parking dostępny dla gości</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cena za dobę (PLN)">
            <Input name="parkingPricePerDay" type="number" step="0.01" min={0}
              defaultValue={initial.parkingPricePerDay ?? ''} placeholder="30" />
          </Field>
          <Field label="Info dodatkowe">
            <Input name="parkingInfo" defaultValue={initial.parkingInfo ?? ''} placeholder="np. hala garażowa -1, wymagana rezerwacja" />
          </Field>
        </div>
      </Section>

      <Section title="IdoBooking">
        <Field label="IdoBooking object ID (do mapowania rezerwacji)">
          <Input name="idobookingId" defaultValue={initial.idobookingId ?? ''} placeholder="np. 12345" />
        </Field>
        <p className="text-xs text-slate-500">
          Pole automatycznie wypełnione po synchronizacji z IdoBooking. Możesz wpisać ręcznie jeśli znasz numer obiektu.
        </p>
      </Section>

      <Section title="Notatki wewnętrzne">
        <Textarea name="notes" defaultValue={initial.notes ?? ''} rows={3} maxLength={1000}
          placeholder="Specjalne instrukcje dla bota — np. „w tym lokalu szczególna cisza po 21”" />
      </Section>

      <SubmitButton label={submitLabel} />
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700 mb-2">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : label}
    </Button>
  )
}
