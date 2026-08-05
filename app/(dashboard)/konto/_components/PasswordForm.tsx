'use client'

import { useActionState, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changeOwnPassword, type ActionResult } from '@/actions/users'

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (prev, fd) => {
      const res = await changeOwnPassword(prev, fd)
      if (res.ok) formRef.current?.reset()
      return res
    },
    { ok: false },
  )

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.message && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            state.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {state.ok ? 'Hasło zmienione ✅ Przy następnym logowaniu użyj nowego hasła.' : state.message}
        </div>
      )}

      <div>
        <Label className="text-xs font-medium block mb-1">Obecne hasło</Label>
        <Input name="currentPassword" type="password" required autoComplete="current-password" />
        {state.errors?.currentPassword && (
          <p className="text-xs text-red-600 mt-1">{state.errors.currentPassword}</p>
        )}
      </div>

      <div>
        <Label className="text-xs font-medium block mb-1">Nowe hasło (min. 8 znaków)</Label>
        <Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
        {state.errors?.newPassword && (
          <p className="text-xs text-red-600 mt-1">{state.errors.newPassword}</p>
        )}
      </div>

      <div>
        <Label className="text-xs font-medium block mb-1">Powtórz nowe hasło</Label>
        <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
        {state.errors?.confirmPassword && (
          <p className="text-xs text-red-600 mt-1">{state.errors.confirmPassword}</p>
        )}
      </div>

      <SubmitBtn />
    </form>
  )
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Zapisywanie...' : 'Zmień hasło'}
    </Button>
  )
}
