import Link from 'next/link'
import { Calculator, Settings2, AlertTriangle } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { requireModule } from '@/lib/modules-server'
import { fmtFullDateTime } from '@/lib/datetime'
import { channelLabel, fmtMarginPct, fmtZl, statusMeta, QUOTE_STATUSES } from '@/lib/quotes'
import { listQuotes } from '@/queries/quotes'
import { NewQuoteButton } from './_components/NewQuoteButton'
import { QuoteRowLink } from './_components/QuoteRowLink'

const TAB_LABEL: Record<string, string> = {
  new: 'Nowe',
  analyzing: 'W analizie',
  ready: 'Gotowe',
  approved: 'Zatwierdzone',
  sent: 'Wysłane',
  rejected: 'Odrzucone',
  failed: 'Błędy',
}

type SearchParams = Promise<{ status?: string }>

export default async function WycenyPage(props: { searchParams: SearchParams }) {
  await requireAuth()
  await requireModule('quotes')
  const params = await props.searchParams
  const status = params.status && QUOTE_STATUSES.includes(params.status as (typeof QUOTE_STATUSES)[number])
    ? params.status
    : undefined

  const { quotes, counts, error } = await listQuotes(status)
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  const tabs = [
    { key: '', label: 'Wszystkie', count: totalCount },
    ...QUOTE_STATUSES.map((s) => ({ key: s, label: TAB_LABEL[s] ?? s, count: counts[s] ?? 0 })),
  ]

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 inline-flex items-center gap-2">
            <Calculator className="h-5 w-5 text-slate-500" /> Wyceny
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Zapytania o wyceny B2B — bot zbiera specyfikację, LLM proponuje kalkulację, Ty zatwierdzasz i wysyłasz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/wyceny/cennik"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Settings2 className="h-4 w-4" /> Cennik
          </Link>
          <NewQuoteButton />
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((t) => (
          <Link
            key={t.key || 'all'}
            href={t.key ? `/wyceny?status=${t.key}` : '/wyceny'}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              (status ?? '') === t.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 text-xs ${(status ?? '') === t.key ? 'text-slate-300' : 'text-slate-400'}`}>
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Calculator className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600 mt-3">Brak wycen{status ? ' w tym statusie' : ''}</p>
          <p className="text-xs text-slate-400 mt-1">
            Wyceny pojawią się tu, gdy bot zbierze zapytanie B2B albo dodasz je ręcznie.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Klient</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Produkt</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Cena/szt</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Wartość</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Marża</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">Kanał</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotes.map((q) => {
                  const st = statusMeta(q.status)
                  const qty = q.quantity ?? q.spec.quantity
                  return (
                    <QuoteRowLink key={q.id} href={`/wyceny/${q.id}`}>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {fmtFullDateTime(new Date(q.createdAt))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {q.customerCompany || q.customerName || q.customerEmail || '—'}
                        </div>
                        {(q.customerCompany || q.customerName) && q.customerEmail && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{q.customerEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs">
                        <span className="line-clamp-2">{q.spec.product ?? '—'}</span>
                        {qty != null && <span className="text-slate-400"> · {qty} szt</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{fmtZl(q.pricePerUnit)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                        {fmtZl(q.priceTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{fmtMarginPct(q.marginPct)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{channelLabel(q.sourceChannel)}</td>
                    </QuoteRowLink>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
