import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { fmtFullDateTime } from '@/lib/datetime'
import { SyncButton } from '@/components/SyncButton'
import { triggerOrderSync } from '@/actions/orders'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

export default async function OrdersPage() {
  await requireAuth()

  const client = await prisma.clients.findUnique({
    where: { slug: CLIENT_SLUG },
    select: { id: true },
  })
  if (!client) return <div className="p-8 text-slate-500">Brak danych klienta.</div>
  const clientId = client.id

  const [orders, statusMap] = await Promise.all([
    prisma.orders_cache.findMany({
      where: { client_id: clientId },
      orderBy: { date_add: 'desc' },
      take: 50,
    }),
    prisma.order_status_map.findMany({ where: { client_id: clientId } }),
  ])
  const statusLookup = Object.fromEntries(statusMap.map((s) => [s.status_id, s.status_name]))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Zamówienia</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ostatnie {orders.length} zamówień z BaseLinker (sync co 10 min). Nr = numer w sklepie (ten, który zna klient).
          </p>
        </div>
        <SyncButton action={triggerOrderSync} idleLabel="Synchronizuj zamówienia" />
      </div>

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
                  Brak zamówień w cache. Kliknij „Synchronizuj zamówienia" lub poczekaj na sync co 10 minut.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
