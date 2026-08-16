import Link from 'next/link'
import { Plus, Wifi, KeyRound, Car } from 'lucide-react'

import { listApartments, listBuildings } from '@/queries/apartments'
import { buttonVariants } from '@/lib/button-variants'
import { getCurrentPermissions } from '@/lib/permissions'
import { ApartmentRowActions } from './_components/ApartmentRowActions'
import { SyncButton } from './_components/SyncButton'
import { activeClientSlug } from '@/lib/tenant'
import { requireModule } from '@/lib/modules-server'


import { buildingLabel, buildingColor } from '@/lib/building-format'

type SearchParams = Promise<{
  building?: string
  q?: string
}>

export default async function ApartmentsPage(props: { searchParams: SearchParams }) {
  await requireModule('apartments')

  const params = await props.searchParams
  const building = params.building ?? 'all'
  const search = params.q ?? ''

  const [rows, buildings, permissions] = await Promise.all([
    listApartments({ clientSlug: (await activeClientSlug()), building, search }),
    listBuildings((await activeClientSlug())),
    getCurrentPermissions(),
  ])
  const canEdit = permissions['apartments.manage']

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Apartamenty</h1>
          <p className="text-sm text-slate-600 mt-1">
            Lista lokali z danymi (WiFi, kody, parking, smartlock) których bot używa przy obsłudze gości.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <SyncButton />
            <Link href="/apartments/new" className={buttonVariants({ size: 'lg' }) + ' gap-1.5'}>
              <Plus className="h-4 w-4" />
              Dodaj
            </Link>
          </div>
        )}
      </header>

      <form className="flex flex-wrap gap-2 items-end p-4 rounded-lg border border-slate-200 bg-white">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">Szukaj</label>
          <input type="text" name="q" defaultValue={search} placeholder="nazwa lub adres"
            className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Budynek</label>
          <select name="building" defaultValue={building} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">wszystkie</option>
            {buildings.map((b) => (
              <option key={b.code} value={b.code}>{buildingLabel(b.code)} ({b.count})</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          Filtruj
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide">Apartament</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-36">Budynek</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide">Dane</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-32">IdoBooking</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600 uppercase tracking-wide w-32">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="text-slate-400 text-sm">Brak apartamentów</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Dodaj ręcznie albo zsynchronizuj z IdoBooking (gdy będzie klucz API)
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    {r.address && <div className="text-xs text-slate-500 mt-0.5">{r.address}</div>}
                    {(r.floor !== null || r.entranceCode) && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {r.entranceCode && <span>{r.entranceCode}</span>}
                        {r.entranceCode && r.floor !== null && <span> · </span>}
                        {r.floor !== null && <span>p. {r.floor}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border border-slate-200 ${buildingColor(r.buildingCode)}`}>
                      {buildingLabel(r.buildingCode)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs space-y-1">
                    {r.wifiSsid && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Wifi className="h-3 w-3" />
                        <code className="font-mono">{r.wifiSsid}</code>
                      </div>
                    )}
                    {(r.smartlockProvider || r.staticAccessCode) && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <KeyRound className="h-3 w-3" />
                        <span>{r.smartlockProvider ?? 'kod stały'}</span>
                      </div>
                    )}
                    {r.parkingAvailable && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Car className="h-3 w-3" />
                        <span>{r.parkingPricePerDay ? `${r.parkingPricePerDay} zł/d` : 'jest'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.idobookingId ? (
                      <code className="font-mono text-slate-600">#{r.idobookingId}</code>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <ApartmentRowActions id={r.id} name={r.name} />
                    ) : (
                      <span className="text-xs text-slate-400">tylko podgląd</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
