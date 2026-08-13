import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, CalendarCheck } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentPermissions } from '@/lib/permissions'
import { activeClientSlug } from '@/lib/tenant'
import { getVertical } from '@/queries/client'
import { listReservations } from '@/queries/reservations'
import { fmtDateLong } from '@/lib/datetime'
import { SyncButton } from '@/components/SyncButton'
import { syncReservationsFromIdoBooking } from '@/actions/apartments'

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'upcoming', label: 'Nadchodzące' },
  { key: 'current', label: 'W trakcie' },
  { key: 'past', label: 'Zakończone' },
]

type SearchParams = Promise<{ status?: string; q?: string; page?: string }>

export default async function ReservationsPage(props: { searchParams: SearchParams }) {
  await requireAuth()
  // Moduł tylko dla rental — ecommerce nie ma rezerwacji (defense-in-depth,
  // Sidebar już nie pokazuje tego linku dla tego verticala).
  const vertical = await getVertical((await activeClientSlug()))
  if (vertical !== 'rental') redirect('/')

  const params = await props.searchParams
  const status = STATUS_TABS.some((t) => t.key === params.status) ? params.status! : 'all'
  const q = (params.q ?? '').trim()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [permissions, slug] = await Promise.all([getCurrentPermissions(), activeClientSlug()])
  // "Sync rezerwacji" woła syncReservationsFromIdoBooking (actions/apartments.ts,
  // guard apartments.manage) — canEdit musi odzwierciedlać TO uprawnienie, nie
  // osobny (nieistniejący) reservations.manage.
  const canEdit = permissions['apartments.manage']

  const { rows, total, pageSize } = await listReservations({ clientSlug: slug, status, q, page })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const buildHref = (patch: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams()
    const merged = { status, q, page, ...patch }
    if (merged.status && merged.status !== 'all') sp.set('status', String(merged.status))
    if (merged.q) sp.set('q', String(merged.q))
    if (merged.page && Number(merged.page) > 1) sp.set('page', String(merged.page))
    const s = sp.toString()
    return s ? `/reservations?${s}` : '/reservations'
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 inline-flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-indigo-500" /> Rezerwacje
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {q ? `${total} wyników dla „${q}".` : `${total} rezerwacji w cache (sync z IdoBooking).`} Podgląd — dane których bot używa przy obsłudze gości.
          </p>
        </div>
        {canEdit && <SyncButton action={syncReservationsFromIdoBooking} idleLabel="Sync rezerwacji" />}
      </header>

      {/* Filtr statusu */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={buildHref({ status: t.key, page: 1 })}
            className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${status === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Szukajka */}
      <form method="GET" action="/reservations" className="flex items-center gap-2 max-w-md">
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Szukaj: nazwisko, telefon, nr rezerwacji…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <button type="submit" className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
          Szukaj
        </button>
        {q && (
          <Link href={buildHref({ q: undefined, page: 1 })} className="text-sm text-slate-500 hover:text-slate-700">
            Wyczyść
          </Link>
        )}
      </form>

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nr</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Gość</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Apartament</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Przyjazd</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Wyjazd</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nocy</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Źródło</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.reservationId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                  {r.reservationId}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{r.guestName || '—'}</div>
                  <div className="text-xs text-slate-400">{r.guestPhone || r.guestEmail || ''}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.apartmentName || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.checkIn ? fmtDateLong(r.checkIn) : '—'}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.checkOut ? fmtDateLong(r.checkOut) : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.nights ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.source || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  {q || status !== 'all'
                    ? 'Brak rezerwacji pasujących do filtra.'
                    : 'Brak rezerwacji w cache. Kliknij „Sync rezerwacji" (wymaga skonfigurowanego IdoBooking).'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Strona {page} z {totalPages} · {total} rezerwacji</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref({ page: page - 1 })} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                ← Poprzednia
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildHref({ page: page + 1 })} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                Następna →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-300">—</span>
  const lower = status.toLowerCase()
  let color = 'bg-slate-100 text-slate-600'
  if (lower.includes('confirm') || lower.includes('potwierdz') || lower.includes('new') || lower.includes('now')) {
    color = 'bg-green-50 text-green-700'
  } else if (lower.includes('cancel') || lower.includes('anul')) {
    color = 'bg-red-50 text-red-700'
  } else if (lower.includes('wait') || lower.includes('pend') || lower.includes('ocze')) {
    color = 'bg-yellow-50 text-yellow-700'
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{status}</span>
}
