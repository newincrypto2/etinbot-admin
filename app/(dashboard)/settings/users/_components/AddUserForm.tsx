'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createUser, type ActionResult } from '@/actions/users'

const ROLES = [
  { value: 'OWNER', label: 'Operator (właściciel obiektu)', hint: 'Pełen dostęp + zarządzanie userami' },
  { value: 'EDITOR', label: 'Editor (recepcja)', hint: 'Może edytować FAQ, apartamenty, eskalacje' },
  { value: 'VIEWER', label: 'Viewer (podgląd)', hint: 'Tylko dashboard + przegląd, bez edycji' },
  { value: 'SUPERADMIN', label: 'Superadmin (devops)', hint: 'Pełen dostęp + Settings + Users' },
]

export function AddUserForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(createUser, { ok: false })

  return (
    <form action={formAction} className="space-y-4">
      {state.message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Imię i nazwisko</Label>
          <Input id="name" name="name" placeholder="Jan Kowalski" required className="h-9" />
          {state.errors?.name && <p className="text-xs text-red-600">{state.errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium">Email</Label>
          <Input id="email" name="email" type="email" placeholder="jan@matysproperty.pl" required className="h-9" />
          {state.errors?.email && <p className="text-xs text-red-600">{state.errors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium">Hasło tymczasowe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Min. 8 znaków"
            required
            minLength={8}
            className="h-9"
          />
          {state.errors?.password && <p className="text-xs text-red-600">{state.errors.password}</p>}
          <p className="text-xs text-slate-500">User powinien zmienić przy pierwszym logowaniu</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role" className="text-xs font-medium">Rola</Label>
          <select
            id="role"
            name="role"
            defaultValue="EDITOR"
            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p className="text-xs text-slate-500">
            {ROLES.find((r) => r.value === 'EDITOR')?.hint}
          </p>
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="gap-1.5">
      <UserPlus className="h-4 w-4" />
      {pending ? 'Dodawanie...' : 'Dodaj użytkownika'}
    </Button>
  )
}
