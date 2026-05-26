'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/client'
import type { EscalationRecipient } from '@/queries/notifications'

type Props = {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial?: EscalationRecipient
  onDone?: () => void
}

const ROLE_OPTIONS = [
  { value: 'office', label: 'Biuro / recepcja' },
  { value: 'security', label: 'Ochrona 24/7' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Właściciel' },
]

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Wszystkie budynki' },
  { value: 'silver-place', label: 'Silver Place' },
  { value: 'silver-forest', label: 'Silver Forest' },
]

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'Wszystkie (pilne + zwykłe)' },
  { value: 'urgent_only', label: 'Tylko pilne (awarie 24/7)' },
  { value: 'normal_only', label: 'Tylko zwykłe (modyfikacje, info)' },
]

export function RecipientForm({ action, initial, onDone }: Props) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })

  const isOk = state.ok && state.message
  if (isOk && onDone) {
    // hack — Server Action resolved, ale form jest controlled; wyzwól onDone z opóźnieniem
    setTimeout(() => onDone(), 300)
  }

  return (
    <form action={formAction} className="space-y-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      {state.message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium block mb-1">Nazwa</Label>
          <Input name="name" defaultValue={initial?.name ?? ''} placeholder="np. Mateusz (biuro)" required />
          {state.errors?.name && <p className="text-xs text-red-600 mt-1">{state.errors.name}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium block mb-1">Numer telefonu</Label>
          <Input name="phone" defaultValue={initial?.phone ?? ''} placeholder="+48 600 100 200" required />
          <p className="text-xs text-slate-500 mt-1">Format E.164 (+48...). Polski 9-cyfrowy bez prefiksu też OK.</p>
          {state.errors?.phone && <p className="text-xs text-red-600 mt-1">{state.errors.phone}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-medium block mb-1">Rola</Label>
          <select name="role" defaultValue={initial?.role ?? 'office'} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium block mb-1">Budynek</Label>
          <select name="scope" defaultValue={initial?.scope ?? 'all'} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
            {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium block mb-1">Filtr ważności</Label>
          <select name="severityFilter" defaultValue={initial?.severityFilter ?? 'all'} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium block mb-1">Notatka (opcjonalna)</Label>
        <Input name="note" defaultValue={initial?.note ?? ''} placeholder="np. tylko weekendy / backup po 22:00" />
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-slate-200/60">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="smsEnabled" defaultChecked={initial?.smsEnabled ?? true} className="h-4 w-4" />
          <span>SMS włączone</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4" />
          <span>Aktywny</span>
        </label>
        <div className="flex-1" />
        <SubmitButton isEdit={!!initial?.id} />
      </div>
    </form>
  )
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : isEdit ? 'Zaktualizuj' : 'Dodaj odbiorcę'}
    </Button>
  )
}

export function AddRecipientButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} variant="outline" className="gap-1.5">
      <Plus className="h-4 w-4" />
      Dodaj odbiorcę
    </Button>
  )
}
