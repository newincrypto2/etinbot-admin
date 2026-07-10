import { PackagePlus } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { fmtFullDateTime } from '@/lib/datetime'
import { listReshipRequests, type ReshipRow } from '@/queries/reship'

const STATUS: Record<string, { label: string; cls: string }> = {
  sent_to_warehouse: { label: 'wysłane do magazynu', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  done: { label: 'zrealizowane', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'błąd', cls: 'bg-red-50 text-red-700 border-red-200' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
  )
}

function OrderCell({ row }: { row: ReshipRow }) {
  const label = row.orderNumber || row.extId || '—'
  if (row.extId) {
    return (
      <a
        href={`https://panel-e.baselinker.com/orders.php#order:${row.extId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:underline font-medium"
      >
        {label}
      </a>
    )
  }
  return <span className="text-slate-800">{label}</span>
}

export default async function ReshipPage() {
  await requireAuth()
  const rows = await listReshipRequests()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 inline-flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-slate-500" /> Dosyłki
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Zlecenia dosyłek/reklamacji zarejestrowane przez bota (max 100 ostatnich).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <PackagePlus className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600 mt-3">Brak dosyłek</p>
          <p className="text-xs text-slate-400 mt-1">
            Gdy bot zleci dosyłkę do magazynu, pojawi się ona tutaj.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Zamówienie</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Pozycje</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Powód</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtFullDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <OrderCell row={r} />
                      {(r.customerEmail || r.customerPhone) && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {r.customerEmail || r.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.items.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {r.items.map((it, i) => (
                            <li key={i}>
                              {it.qty != null && <span className="text-slate-400">{it.qty}× </span>}
                              {it.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">{r.reason || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
