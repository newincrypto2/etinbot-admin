import Link from 'next/link'
import { Coins, ArrowRight, AlertTriangle, Download } from 'lucide-react'

import {
  getAvailableMonths,
  getMonthlySummary,
  getTopConversations,
} from '@/queries/costs'
import { fmtPln, fmtUnits, serviceName, withMargin } from '@/lib/cost-format'
import { fmtDateShort } from '@/lib/datetime'
import { activeClientSlug } from '@/lib/tenant'


const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  voice: 'Telefon',
  idobooking: 'IdoBooking',
}

function currentMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function monthLabel(monthIso: string): string {
  // 'YYYY-MM' lub 'YYYY-MM-01'
  const ym = monthIso.slice(0, 7)
  const [y, m] = ym.split('-')
  const monthNames = [
    'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
  ]
  const name = monthNames[parseInt(m, 10) - 1] ?? m
  return `${name} ${y}`
}

export default async function BillingPage(props: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await props.searchParams
  const monthRaw = sp.month?.match(/^\d{4}-\d{2}$/) ? `${sp.month}-01` : currentMonthIso()
  const ym = monthRaw.slice(0, 7)

  const [summary, top, available] = await Promise.all([
    getMonthlySummary((await activeClientSlug()), monthRaw),
    getTopConversations((await activeClientSlug()), monthRaw, 5),
    getAvailableMonths((await activeClientSlug())),
  ])

  // Wstaw bieżący miesiąc jeśli nie ma jeszcze rekordów (żeby selector pokazał obecny)
  const months = Array.from(new Set([ym, ...available])).sort().reverse()

  const totalBilledPln = withMargin(summary.total_pln) ?? 0
  const avgBilledPerConv =
    summary.conversation_count > 0
      ? (totalBilledPln / summary.conversation_count).toFixed(2)
      : null

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-500" />
            Koszty {monthLabel(ym)}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Per-event ledger kosztów u dostawców (LLM, voice, SMS, embeddings).
            Reconciliation cron co 30 min update'uje estymaty na realne kwoty z API.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <form className="flex items-center gap-2">
            <label htmlFor="month" className="text-xs text-slate-500 uppercase tracking-wide">
              Miesiąc
            </label>
            <select
              id="month"
              name="month"
              defaultValue={ym}
              className="border border-slate-200 rounded-md text-sm px-3 py-1.5 bg-white"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700"
            >
              Pokaż
            </button>
          </form>
          <a
            href={`/api/billing/export?month=${ym}&format=summary`}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            CSV summary
          </a>
          <a
            href={`/api/billing/export?month=${ym}&format=detail`}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            CSV detail
          </a>
        </div>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Razem PLN" value={fmtPln(totalBilledPln)} accent="amber" />
        <Kpi label="Rozmów" value={summary.conversation_count.toString()} />
        <Kpi
          label="Średnia / rozmowa"
          value={avgBilledPerConv ? fmtPln(avgBilledPerConv) : '—'}
        />
      </div>

      {/* Breakdown per service */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-sm font-semibold text-slate-700">Podział per usługa</h2>
        </div>
        {summary.byService.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Brak kosztów w tym miesiącu.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50/40">
                <th className="px-4 py-2 font-medium">Usługa</th>
                <th className="px-4 py-2 font-medium text-right">Zużycie</th>
                <th className="px-4 py-2 font-medium text-right">PLN</th>
                <th className="px-4 py-2 font-medium text-right">% udziału</th>
              </tr>
            </thead>
            <tbody>
              {summary.byService.map((row) => {
                const plnNet = parseFloat(row.cost_pln || '0')
                const total = parseFloat(summary.total_pln || '0')
                const share = total > 0 ? (plnNet / total) * 100 : 0
                return (
                  <tr key={row.service + row.unit_type} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-800">{serviceName(row.service)}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-slate-600">
                      {fmtUnits(row.units, row.unit_type)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs font-medium text-slate-900">
                      {fmtPln(withMargin(row.cost_pln))}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-500">
                      {share.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Top 5 najdroższych rozmów */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <h2 className="text-sm font-semibold text-slate-700">Top 5 najdroższych rozmów</h2>
        </div>
        {top.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Brak rozmów z kosztami w tym miesiącu.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {top.map((row, idx) => (
              <li key={row.conversation_id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50">
                <div className="text-lg font-semibold text-slate-400 w-6 text-center">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-900 truncate">
                      {row.guest_name ?? row.conversation_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                      {CHANNEL_LABEL[row.channel] ?? row.channel}
                    </span>
                    {row.has_escalation && (
                      <span className="text-[10px] uppercase tracking-wide text-red-700 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        eskalacja
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                    <span>{fmtDateShort(row.created_at)}</span>
                    {row.duration_minutes && parseFloat(row.duration_minutes) > 0 && (
                      <span>{parseFloat(row.duration_minutes).toFixed(1)} min</span>
                    )}
                    <span>{row.message_count} wiadomości</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {fmtPln(withMargin(row.cost_pln))}
                  </div>
                </div>
                <Link
                  href={`/conversations/${row.conversation_id}`}
                  className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
                >
                  Otwórz <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-slate-400">
        Kursy USD/PLN z NBP, aktualizacja codziennie 06:00 UTC. Koszty `source=computed` to
        estymaty z cennika lokalnego — reconciliation cron co 30 min podmienia je na realne
        kwoty z Twilio Messages API i ElevenLabs metadata.cost.
      </p>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'amber' | 'slate'
}) {
  const colorClass =
    accent === 'amber'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-slate-900 bg-white border-slate-200'
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{sub}</div>}
    </div>
  )
}
