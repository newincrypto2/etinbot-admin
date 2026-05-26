import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getApartmentById } from '@/queries/apartments'
import { updateApartment } from '@/actions/apartments'
import { ApartmentForm } from '../../_components/ApartmentForm'

export default async function EditApartmentPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const apt = await getApartmentById(id)
  if (!apt) notFound()

  const updateAction = updateApartment.bind(null, id)

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/apartments" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do listy
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Edycja apartamentu</h1>
        <p className="text-sm text-slate-600 mt-1">{apt.name}</p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ApartmentForm
          action={updateAction}
          initial={{
            name: apt.name,
            buildingCode: apt.buildingCode as any,
            address: apt.address,
            floor: apt.floor,
            entranceCode: apt.entranceCode,
            accessMethod: apt.accessMethod as any,
            smartlockProvider: apt.smartlockProvider as any,
            staticAccessCode: apt.staticAccessCode,
            wifiSsid: apt.wifiSsid,
            wifiPassword: apt.wifiPassword,
            parkingAvailable: apt.parkingAvailable ?? false,
            parkingPricePerDay: apt.parkingPricePerDay ? Number(apt.parkingPricePerDay) : null,
            parkingInfo: apt.parkingInfo,
            maxGuests: apt.maxGuests,
            idobookingId: apt.idobookingId,
            notes: apt.notes,
          }}
          submitLabel="Zapisz zmiany"
        />
      </div>
    </div>
  )
}
