import Link from 'next/link'
import { Mail, AlertTriangle, FileText, Inbox } from 'lucide-react'

import { listEmailThreads, getEmailStats } from '@/queries/email'
import { fmtDateTime } from '@/lib/datetime'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'krainaherbaty'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: 'Otwarta', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  escalated: { label: 'Do uwagi', color: 'bg-red-100 text-red-700 border-red-200' },
  closed: { label: 'Zamknięta', color: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const DRAFT_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft czeka', color: 'bg-amber-100 text-amber-800' },
  sent: { label: 'Wysłano', color: 'bg-emerald-100 text-emerald-700' },
  discarded: { label: 'Odrzucony', color: 'bg-slate-100 text-slate-500' },
}

type SearchParams = Promise<{ status?: string }>

export default async function PocztaPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams
  const status = params.status ?? 'all'

  const [rows, stats] = await Promise.all([
    listEmailThreads({ clientSlug: CLIENT_SLUG, status, limit: 200 }),
    getEmailStats(CLIENT_SLUG),
  ])

  const filters = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'open', label: 'Otwarte' },
    { key: 'escalated', label: 'Do uwagi' },
    { key: 'closed', label: 'Zamknięte' },
  ]

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Poczta</h1>
          <p className="text-sm text-slate-600 mt-1">
            Maile klientów. Bot generuje draft odpowiedzi — Ty zatwierdzasz, edytujesz albo piszesz
            sam rdzeń (quick-reply). Nic nie wychodzi bez Twojej akceptacji.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Wątki razem" value={stats.total} icon={<Inbox className="h-4 w-4" />} />
        <StatCard label="Otwarte" value={stats.open} icon={<Mail className="h-4 w-4" />} colorClass="text-emerald-600" />
        <StatCard label="Do uwagi" value={stats.escalated} icon={<AlertTriangle className="h-4 w-4" />} colorClass="text-red-600" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/poczta' : `/poczta?status=${f.key}`}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              status === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Brak maili w tym widoku.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.open
              const dr = r.draftStatus ? DRAFT_LABEL[r.draftStatus] : null
              return (
                <li key={r.id}>
                  <Link
                    href={`/poczta/${r.id}`}
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="mt-0.5 h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 truncate">
                          {r.guestName ?? r.guestEmail ?? '—'}
                        </span>
                        <span className="text-xs text-slate-400">{r.guestEmail}</span>
                      </div>
                      <div className="text-sm text-slate-600 truncate mt-0.5">{r.subject ?? '(bez tematu)'}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        na {r.inboxAddress ?? '—'} · {fmtDateTime(r.lastMessageAt)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                      {dr && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${dr.color}`}>
                          <FileText className="h-3 w-3" />
                          {dr.label}
                        </span>
                      )}
                      {r.draftEscalated && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          bot niepewny
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  colorClass = 'text-slate-900',
}: {
  label: string
  value: number
  icon?: React.ReactNode
  colorClass?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={colorClass}>{icon}</span>
      </div>
      <div className={`text-2xl font-semibold mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}
