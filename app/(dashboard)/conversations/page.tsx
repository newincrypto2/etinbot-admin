import Link from 'next/link'
import { MessageCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'

import { listConversations, getConversationStats } from '@/queries/conversations'
import { fmtDateTime } from '@/lib/datetime'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  voice: 'Telefon',
  idobooking: 'IdoBooking',
}

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-700',
  sms: 'bg-blue-100 text-blue-700',
  email: 'bg-slate-100 text-slate-700',
  voice: 'bg-violet-100 text-violet-700',
  idobooking: 'bg-amber-100 text-amber-700',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: 'Otwarta', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  escalated: { label: 'Eskalacja', color: 'bg-red-100 text-red-700 border-red-200' },
  closed: { label: 'Zamknięta', color: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const LANG_FLAG: Record<string, string> = { pl: '🇵🇱', en: '🇬🇧', uk: '🇺🇦', de: '🇩🇪', ru: '🇷🇺' }

type SearchParams = Promise<{ status?: string; channel?: string; q?: string }>

export default async function ConversationsPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams
  const status = params.status ?? 'all'
  const channel = params.channel ?? 'all'
  const search = params.q ?? ''

  const [rows, stats] = await Promise.all([
    listConversations({ clientSlug: CLIENT_SLUG, status, channel, search, limit: 200 }),
    getConversationStats(CLIENT_SLUG),
  ])

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Konwersacje</h1>
          <p className="text-sm text-slate-600 mt-1">
            Rozmowy bota z gośćmi. Każdy wiersz to thread (WhatsApp / SMS / email / voice / IdoBooking).
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Razem" value={stats.total} />
        <StatCard label="Otwarte" value={stats.open} icon={<MessageCircle className="h-4 w-4" />} colorClass="text-emerald-600" />
        <StatCard label="Eskalacje" value={stats.escalated} icon={<AlertTriangle className="h-4 w-4" />} colorClass="text-red-600" />
        <StatCard label="Zamknięte" value={stats.closed} icon={<CheckCircle2 className="h-4 w-4" />} colorClass="text-slate-500" />
      </div>

      {/* Filtry */}
      <form className="flex flex-wrap gap-2 items-end p-4 rounded-lg border border-slate-200 bg-white">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">Szukaj</label>
          <input type="text" name="q" defaultValue={search} placeholder="telefon, email, imię, ID rezerwacji"
            className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Status</label>
          <select name="status" defaultValue={status} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">wszystkie</option>
            <option value="open">otwarte</option>
            <option value="escalated">eskalacje</option>
            <option value="closed">zamknięte</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Kanał</label>
          <select name="channel" defaultValue={channel} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">wszystkie</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="voice">Telefon</option>
            <option value="idobooking">IdoBooking</option>
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          Filtruj
        </button>
      </form>

      {/* Lista */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide">Gość / thread</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-32">Kanał</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-32">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-20 text-center">Wiad.</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-40">Ostatnia akt.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                Brak konwersacji {search ? 'pasujących do filtrów' : '— bot jeszcze nie miał żadnej rozmowy'}
              </td></tr>
            ) : rows.map((r) => {
              const stmeta = STATUS_LABEL[r.status] ?? STATUS_LABEL.open
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3" colSpan={1}>
                    <Link href={`/conversations/${r.id}`} className="block">
                      <div className="font-medium text-slate-900 flex items-center gap-1.5">
                        {r.language && LANG_FLAG[r.language] && (
                          <span className="text-base leading-none">{LANG_FLAG[r.language]}</span>
                        )}
                        {r.guestName ?? r.guestPhone ?? r.guestEmail ?? r.threadId}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {[r.guestPhone, r.guestEmail].filter(Boolean).join(' · ')}
                      </div>
                      {r.lastMessagePreview && (
                        <div className="text-xs text-slate-500 mt-1 line-clamp-1 italic">
                          „{r.lastMessagePreview}"
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${CHANNEL_COLOR[r.channel] ?? 'bg-slate-100 text-slate-700'}`}>
                      {CHANNEL_LABEL[r.channel] ?? r.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${stmeta.color}`}>
                      {stmeta.label}
                    </span>
                    {r.hasEscalation && r.status !== 'escalated' && (
                      <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-mono text-slate-600">{r.messageCount}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {fmtDateTime(r.lastMessageAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, colorClass = 'text-slate-700' }: {
  label: string; value: number; icon?: React.ReactNode; colorClass?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
        {icon && <span className={colorClass}>{icon}</span>}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${colorClass}`}>{value}</div>
    </div>
  )
}
