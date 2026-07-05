import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import { listEscalations, getEscalationStats } from '@/queries/escalations'
import { getCurrentRole, hasRole } from '@/lib/auth-helpers'
import { EscalationCard } from './_components/EscalationCard'
import { ResolveAllButton } from './_components/ResolveAllButton'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

const REASON_LABEL: Record<string, string> = {
  unknown_question: 'Nieznane pytanie',
  modification_request: 'Zmiana / anulowanie',
  complaint: 'Reklamacja',
  emergency: 'Sytuacja pilna',
  investment_inquiry: 'Zapytanie B2B / hurt',
  billing_dispute: 'Spór o płatność',
  other_human_needed: 'Inne — wymaga człowieka',
  auto_detected_from_response: 'Sprawa do obsługi',
  'user request': 'Prośba klienta o człowieka',
  b2b_inquiry: 'Zapytanie B2B / hurt',
  return_request: 'Zwrot',
  order_not_found: 'Nie znaleziono zamówienia',
}

type SearchParams = Promise<{ status?: 'unresolved' | 'resolved' | 'all'; reason?: string }>

export default async function EscalationsPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams
  const status = params.status ?? 'unresolved'
  const reason = params.reason ?? 'all'

  const [rows, stats, role] = await Promise.all([
    listEscalations({ clientSlug: CLIENT_SLUG, status, reason }),
    getEscalationStats(CLIENT_SLUG),
    getCurrentRole(),
  ])
  const canEdit = hasRole(role, 'EDITOR')

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Eskalacje</h1>
          <p className="text-sm text-slate-600 mt-1">
            Sprawy przekazane przez bota do człowieka. Rozwiąż lub zaakceptuj jako nowe FAQ (bot się uczy).
          </p>
        </div>
        {canEdit && status === 'unresolved' && (
          <ResolveAllButton reason={reason} count={rows.length} />
        )}
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Nierozwiązane" value={stats.unresolved} icon={<AlertTriangle className="h-4 w-4" />} colorClass="text-red-600" highlight />
        <StatCard label="Rozwiązane" value={stats.resolved} icon={<CheckCircle2 className="h-4 w-4" />} colorClass="text-emerald-600" />
        <StatCard label="Razem (30d)" value={stats.total} colorClass="text-slate-700" />
      </div>

      {stats.byReason.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Top przyczyny eskalacji
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.byReason.slice(0, 6).map((r) => (
              <div key={r.reason} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                {REASON_LABEL[r.reason] ?? r.reason}: <strong>{r.count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtry */}
      <form className="flex flex-wrap gap-2 items-end p-4 rounded-lg border border-slate-200 bg-white">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Status</label>
          <select name="status" defaultValue={status} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="unresolved">nierozwiązane</option>
            <option value="resolved">rozwiązane</option>
            <option value="all">wszystkie</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Przyczyna</label>
          <select name="reason" defaultValue={reason} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">wszystkie</option>
            {Object.entries(REASON_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          Filtruj
        </button>
      </form>

      {/* Lista — karty z akcjami */}
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <div className="text-sm text-slate-600 font-medium">
              {status === 'unresolved' ? 'Wszystkie eskalacje rozwiązane! 🎉' : 'Brak eskalacji'}
            </div>
          </div>
        ) : (
          rows.map((esc) => (
            <EscalationCard
              key={esc.id}
              escalation={esc}
              reasonLabel={REASON_LABEL[esc.reason] ?? esc.reason}
              canEdit={canEdit}
            />
          ))
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, colorClass = 'text-slate-700', highlight }: {
  label: string
  value: number
  icon?: React.ReactNode
  colorClass?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight && value > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
        {icon && <span className={colorClass}>{icon}</span>}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${colorClass}`}>{value}</div>
    </div>
  )
}
