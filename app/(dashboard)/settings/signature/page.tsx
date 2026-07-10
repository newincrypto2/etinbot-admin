import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { saveMySignature } from '@/actions/signature'
import { SignatureForm } from './_components/SignatureForm'


export default async function SignatureSettingsPage() {
  // Dostęp: KAŻDY zalogowany użytkownik — edytuje wyłącznie WŁASNĄ stopkę.
  const session = await requireAuth()
  const email = session.user?.email
  if (!email) redirect('/login')

  const me = await prisma.adminUser.findUnique({
    where: { email },
    select: { emailSignatureHtml: true },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do ustawień
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Moja stopka</h1>
        <p className="text-sm text-slate-600 mt-1">
          Twój osobisty podpis doklejany do wysyłanych maili.
        </p>
      </header>

      <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        Stopka jest doklejana do maili, które <strong>WYSYŁASZ</strong> z Poczty — po
        „Pozdrawiam,". Drafty bota nie zawierają podpisu.
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <SignatureForm action={saveMySignature} initial={me?.emailSignatureHtml ?? ''} />
      </div>
    </div>
  )
}
