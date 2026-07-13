import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createApartment } from '@/actions/apartments'
import { getBuildings } from '@/queries/buildings'
import { ApartmentForm } from '../_components/ApartmentForm'

export default async function NewApartmentPage() {
  const buildings = await getBuildings()
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/apartments" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do listy
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Nowy apartament</h1>
        <p className="text-sm text-slate-600 mt-1">
          Dane apartamentu z których bot korzysta przy odpowiedziach gościom.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ApartmentForm action={createApartment} submitLabel="Utwórz" buildings={buildings} />
      </div>
    </div>
  )
}
