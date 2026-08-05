import { requireAuth } from '@/lib/auth-helpers'
import { PasswordForm } from './_components/PasswordForm'

export default async function PasswordSettingsPage() {
  // Dostęp: KAŻDY zalogowany użytkownik — zmienia wyłącznie WŁASNE hasło.
  await requireAuth()

  return (
    <div className="max-w-md space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Zmiana hasła</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ustaw nowe hasło do swojego konta w panelu.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <PasswordForm />
      </div>
    </div>
  )
}
