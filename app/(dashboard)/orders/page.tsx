import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export default async function OrdersPage() {
  await requireAuth()

  const clientId = process.env.CLIENT_ID!
  const orders = await prisma.orders_cache.findMany({
    where: { client_id: clientId },
    orderBy: { date_add: 'desc' },
    take: 50,
  })

  const statusMap = await prisma.order_status_map.findMany({
    where: { client_id: clientId },
  })
  const statusLookup = Object.fromEntries(
    statusMap.map(s => [s.status_id, s.status_name])
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Zamowienia</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ostatnie {orders.length} zamowien z BaseLinker (sync co 10 min)
        </p>
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
            {orders.map(o => {
              const statusName = (o.status_id !== null ? statusLookup[o.status_id] : null) || o.status || '-'
              return (
                <tr key={String(o.id)} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">#{o.ext_id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{o.customer_name || '-'}</div>
                    <div className="text-xs text-slate-400">{o.customer_email || o.customer_phone || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={statusName} />
                  </td>
                  <td className="px-4 py-3 font-medium">
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
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {o.date_add ? new Date(o.date_add).toLocaleString('pl-PL') : '-'}
                  </td>
                </tr>
              )
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  Brak zamowien w cache. Sync uruchomi sie automatycznie co 10 minut.
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
  if (lower.includes('wyslan') || lower.includes('sent') || lower.includes('delivered')) {
    color = 'bg-green-50 text-green-700'
  } else if (lower.includes('nowe') || lower.includes('new') || lower.includes('pending')) {
    color = 'bg-blue-50 text-blue-700'
  } else if (lower.includes('anulowane') || lower.includes('cancel')) {
    color = 'bg-red-50 text-red-700'
  } else if (lower.includes('realizacja') || lower.includes('processing')) {
    color = 'bg-yellow-50 text-yellow-700'
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{status}</span>
}
