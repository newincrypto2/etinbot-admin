import { redirect } from 'next/navigation'

import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { saveMySignature } from '@/actions/signature'
import { ProfileForm } from './_components/ProfileForm'
import { PasswordForm } from './_components/PasswordForm'
import { SignatureForm } from './_components/SignatureForm'

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  OWNER: 'Operator',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
}

export default async function KontoPage() {
  // Dostęp: KAŻDY zalogowany użytkownik — edytuje wyłącznie WŁASNE konto.
  const session = await requireAuth()
  const email = session.user?.email
  if (!email) redirect('/login')

  const me = await prisma.adminUser.findUnique({
    where: { email },
    select: { name: true, email: true, role: true, emailSignatureHtml: true },
  })
  if (!me) redirect('/login')

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Moje konto</h1>
        <p className="text-sm text-slate-600 mt-1">
          {me.email} · {ROLE_LABEL[me.role] ?? me.role}
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Moje dane</h2>
        <ProfileForm initialName={me.name} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Moja stopka</h2>
        <p className="text-xs text-slate-500 mb-4">
          Osobisty podpis doklejany do maili, które <strong>wysyłasz</strong> z Poczty — po
          „Pozdrawiam,". Drafty bota nie zawierają podpisu.
        </p>
        <SignatureForm action={saveMySignature} initial={me.emailSignatureHtml ?? ''} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Zmiana hasła</h2>
        <PasswordForm />
      </section>
    </div>
  )
}
