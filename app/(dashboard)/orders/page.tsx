import Link from 'next/link'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { fmtFullDateTime } from '@/lib/datetime'
import { SyncButton } from '@/components/SyncButton'
import { triggerOrderSync } from '@/actions/orders'
import { Search } from 'lucide-react'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'
const PAGE_SIZE = 25

type SearchParams = Promise<{ q?: string; page?: string }>

export default async function OrdersPage(props: { searchParams: SearchParams }) {
  await requireAuth()
  const params = await props.searchParams
  const q = (params.q ?? '').trim()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const client = await prisma.clients.findUnique({
    where: { slug: CLIENT_SLUG },
    select: { id: true },
  })
  if (!client) return <div className="p-8 text-slate-500">Brak danych klienta.</div>
  const clientId = client.id

  // Wyszukiwarka: numer sklepu / numer BL / nazwisko / email / telefon —
  // przy obsłudze klienta to podstawowe narzędzie (wcześniej: tylko ostatnie 50).
  const where = {
    client_id: clientId,
    ...(q
      ? {
          OR: [
            { shop_order_id: { contains: q } },
            { ext_id: { contains: q } },
            { customer_name: { contains: q, mode: 'insensitive' as const } },
            { customer_email: { contains: q, mode: 'insensitive' as const } },
            { customer_phone: { contains: q.replace(/\s+/g, '') } },
          ],
        }
      : {}),
  }

  const [orders, total, statusMap] = await Promise.all([
    prisma.orders_cache.findMany({
      where,
      orderBy: { date_add: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.orders_cache.count({ where }),
    prisma.order_status_map.findMany({ where: { client_id: clientId } }),
  ])
  const statusLookup = Object.fromEntries(statusMap.map((s) => [s.status_id, s.status_name]))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageHref = (p: number) => `/orders?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Zamówienia</h1>
          <p className="text-sm text-slate-500 mt-1">
            {q ? `${total} wyników dla „${q}"` : `${total} zamówień w cache (sync z BaseLinker co 10 min).`} Nr = numer w sklepie (ten, który zna klient).
          </p>
        </div>
        <SyncButton action={triggerOrderSync} idleLabel="Synchronizuj zamówienia" />
      </div>

      <form method="GET" action="/orders" className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Szukaj: nr zamówienia, nazwisko, email, telefon…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <button type="submit" className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
          Szukaj
        </button>
        {q && (
          <Link href="/orders" className="text-sm text-slate-500 hover:text-slate-700">
            Wyczyść
          </Link>
        )}
      </form>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nr</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Klient</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Kwota</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Dostawa</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tracking</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => {
              const statusName = (o.status_id !== null ? statusLookup[o.status_id] : null) || o.status || '-'
              return (
                <tr key={String(o.id)} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-medium text-slate-900">
                      {o.shop_order_id ? `#${o.shop_order_id}` : <span className="text-slate-400">brak nr sklepu</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">BL: {o.ext_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{o.customer_name || '-'}</div>
                    <div className="text-xs text-slate-400">{o.customer_email || o.customer_phone || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={statusName} />
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {o.total_pln?.toString() || '-'} {o.currency || 'PLN'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{o.delivery_method || '-'}</td>
                  <td className="px-4 py-3 text-xs">
                    {o.tracking_number ? (
                      o.tracking_url ? (
                        <a href={o.tracking_url} target="_blank" rel="noopener" className="text-indigo-600 hover:underline">
                          {o.tracking_number}
                        </a>
                      ) : (
                        <span className="font-mono">{o.tracking_number}</span>
                      )
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {o.date_add ? fmtFullDateTime(o.date_add) : '-'}
                  </td>
                </tr>
              )
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  {q
                    ? 'Brak zamówień pasujących do wyszukiwania. Cache trzyma ostatnie 14 dni + zamówienia dociągnięte przez bota.'
                    : 'Brak zamówień w cache. Kliknij „Synchronizuj zamówienia" lub poczekaj na sync co 10 minut.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Strona {page} z {totalPages} · {total} zamówień
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                ← Poprzednia
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50">
                Następna →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase()
  let color = 'bg-slate-100 text-slate-600'
  if (lower.includes('wyslan') || lower.includes('wysłan') || lower.includes('sent') || lower.includes('delivered')) {
    color = 'bg-green-50 text-green-700'
  } else if (lower.includes('nowe') || lower.includes('new') || lower.includes('pending')) {
    color = 'bg-blue-50 text-blue-700'
  } else if (lower.includes('anulowane') || lower.includes('cancel')) {
    color = 'bg-red-50 text-red-700'
  } else if (lower.includes('realizacja') || lower.includes('processing') || lower.includes('wysłania')) {
    color = 'bg-yellow-50 text-yellow-700'
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{status}</span>
}
