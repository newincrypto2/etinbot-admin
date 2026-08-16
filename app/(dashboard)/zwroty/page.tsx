import { ExternalLink, Undo2, Package } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { requireModule } from '@/lib/modules-server'
import { listAllegroReturns } from '@/queries/email'
import { fmtFullDateTime } from '@/lib/datetime'
import { activeClientSlug } from '@/lib/tenant'

const RETURN_STATUS_LABEL: Record<string, string> = {
  CREATED: 'Utworzony',
  IN_TRANSIT: 'W drodze',
  DELIVERED: 'Dostarczony',
  FINISHED: 'Zakończony',
  REJECTED: 'Odrzucony',
  COMMISSION_REFUNDED: 'Prowizja zwrócona',
  REFUNDED: 'Zwrot wypłacony',
  CANCELLED: 'Anulowany',
}


export default async function ZwrotyPage() {
  await requireAuth()
  await requireModule('returns_allegro')
  const returns = await listAllegroReturns({ clientSlug: (await activeClientSlug()), limit: 200 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold inline-flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-slate-500" /> Zwroty Allegro
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Zwroty klienckie z Allegro (sync co 5 min). Decyzję o zwrocie pieniędzy podejmujesz na Allegro —
          kliknij „Otwórz na Allegro". Nowy zwrot wysyła powiadomienie SMS.
        </p>
      </div>

      {returns.length === 0 ? (
        <div className="text-sm text-slate-400">Brak zwrotów.</div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    Zwrot {r.referenceNumber ? `nr ${r.referenceNumber}` : r.returnId.slice(0, 8)}
                    {r.buyerLogin ? <span className="font-normal text-slate-500"> · {r.buyerLogin}</span> : null}
                  </div>
                  <div className="mt-1.5 text-sm text-slate-700 space-y-0.5">
                    {r.items.map((it, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5 mr-3">
                        <Package className="h-3.5 w-3.5 text-slate-400" />
                        {it.name}{it.quantity ? ` ×${it.quantity}` : ''}
                        {it.price ? <span className="text-slate-400"> ({it.price} zł)</span> : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-slate-500">
                    {r.status ? <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{RETURN_STATUS_LABEL[r.status] ?? r.status}</span> : null}
                    {r.refundText ? <span>Zwrot: {r.refundText}</span> : null}
                    {r.createdAt ? <span>{fmtFullDateTime(r.createdAt)}</span> : null}
                  </div>
                </div>
                <a
                  href={r.allegroUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Otwórz na Allegro
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
