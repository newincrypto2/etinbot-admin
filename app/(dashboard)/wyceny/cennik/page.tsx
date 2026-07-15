import Link from 'next/link'
import { ArrowLeft, Settings2, AlertTriangle } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { listCostItems } from '@/queries/quotes'
import { CennikEditor } from './_components/CennikEditor'

export default async function CennikPage() {
  await requireAuth()
  const { items, error } = await listCostItems()

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/wyceny" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do wycen
      </Link>

      <header>
        <h1 className="text-xl font-semibold text-slate-900 inline-flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-slate-500" /> Cennik kosztów wycen
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Baza kosztów (materiały, opakowania, robocizna, transport) używana przez LLM i przez Ciebie w kalkulacjach.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <CennikEditor items={items} />
    </div>
  )
}
