'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult, FaqInput } from '@/actions/faq'

type Props = {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial?: Partial<FaqInput> & { answerVoice?: string | null }
  categories: string[]
  submitLabel?: string
}

const SCOPES = [
  { value: 'both', label: 'Oba budynki' },
  { value: 'silver-place', label: 'Silver Place' },
  { value: 'silver-forest', label: 'Silver Forest' },
]

export function FaqForm({ action, initial = {}, categories, submitLabel = 'Zapisz' }: Props) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })

  return (
    <form action={formAction} className="space-y-5">
      {state.message && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <Field label="Pytanie" name="question" error={state.errors?.question}>
        <Input name="question" defaultValue={initial.question ?? ''} required maxLength={500} />
      </Field>

      <Field label="Odpowiedź (pełna, dla kanałów tekstowych)" name="answer" error={state.errors?.answer}>
        <Textarea name="answer" defaultValue={initial.answer ?? ''} required rows={6} maxLength={5000} />
        <p className="text-xs text-slate-500 mt-1">
          Po zapisie krótka wersja dla bota głosowego (max 2 zdania) wygenerowana zostanie automatycznie przez Claude.
        </p>
        {initial.answerVoice && (
          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="font-medium text-slate-600 mb-1">Aktualna wersja głosowa:</div>
            <div className="text-slate-700">{initial.answerVoice}</div>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Kategoria" name="category" error={state.errors?.category}>
          <Input
            name="category"
            defaultValue={initial.category ?? ''}
            required
            list="faq-categories"
            placeholder="np. parking, wifi"
          />
          <datalist id="faq-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>

        <Field label="Budynek (scope)" name="scope">
          <select
            name="scope"
            defaultValue={initial.scope ?? 'both'}
            className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm bg-white"
          >
            {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
        Pytanie wpisujesz <strong>po polsku</strong>. Tłumaczenia na EN/UA/DE zostaną wygenerowane
        automatycznie przy zapisie i pojawią się w sekcji „Tłumaczenia" poniżej formularza.
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial.isActive ?? true}
          className="h-4 w-4"
        />
        <span>Aktywne (bot używa tego wpisu)</span>
      </label>

      <SubmitButton label={submitLabel} />
    </form>
  )
}

function Field({ label, name, error, children }: {
  label: string
  name: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={name} className="text-sm font-medium text-slate-700 block mb-1.5">
        {label}
      </Label>
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
