import Link from 'next/link'
import { Plus } from 'lucide-react'

import { listFaq, getFaqStats } from '@/queries/faq'
import { getVertical } from '@/queries/client'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/lib/button-variants'
import { getCurrentRole, hasRole } from '@/lib/auth-helpers'
import { FaqRowActions } from './_components/FaqRowActions'
import { activeClientSlug } from '@/lib/tenant'


const SCOPE_LABEL: Record<string, string> = {
  both: 'oba',
  'silver-place': 'Silver Place',
  'silver-forest': 'Silver Forest',
}

const SCOPE_COLOR: Record<string, string> = {
  both: 'bg-slate-100 text-slate-700',
  'silver-place': 'bg-blue-100 text-blue-700',
  'silver-forest': 'bg-emerald-100 text-emerald-700',
}

type SearchParams = Promise<{
  scope?: string
  category?: string
  q?: string
}>

export default async function FaqPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams
  const scope = params.scope ?? 'all'
  const category = params.category ?? 'all'
  const search = params.q ?? ''

  const [rows, stats, role, vertical] = await Promise.all([
    listFaq({ clientSlug: (await activeClientSlug()), scope, category, search }),
    getFaqStats((await activeClientSlug())),
    getCurrentRole(),
    getVertical((await activeClientSlug())),
  ])
  const canEdit = hasRole(role, 'EDITOR')
  const isEcom = vertical === 'ecommerce'

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">FAQ</h1>
          <p className="text-sm text-slate-600 mt-1">
            Pytania i odpowiedzi z których bot korzysta przy obsłudze gości.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-semibold text-slate-900">{stats.active} / {stats.total}</div>
            <div className="text-xs text-slate-500">aktywne / wszystkie</div>
          </div>
          {canEdit && (
            <Link href="/faq/new" className={buttonVariants({ size: 'lg' }) + ' gap-1.5'}>
              <Plus className="h-4 w-4" />
              Dodaj
            </Link>
          )}
        </div>
      </header>

      {/* Statystyki — scope (tylko rental) + kategoria */}
      <div className={isEcom ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {!isEcom && (
          <StatGroup title="Per budynek" items={stats.byScope.map((s) => ({ label: SCOPE_LABEL[s.scope] ?? s.scope, count: s.count }))} />
        )}
        <StatGroup title="Per kategoria" items={stats.byCategory.slice(0, 6).map((c) => ({ label: c.category, count: c.count }))} />
      </div>

      {/* Filtry */}
      <form className="flex flex-wrap gap-2 items-end p-4 rounded-lg border border-slate-200 bg-white">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">Szukaj</label>
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="np. parking, śmieci, kod"
            className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm"
          />
        </div>
        {!isEcom && (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Budynek</label>
            <select name="scope" defaultValue={scope} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
              <option value="all">wszystkie</option>
              <option value="both">oba</option>
              <option value="silver-place">Silver Place</option>
              <option value="silver-forest">Silver Forest</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Kategoria</label>
          <select name="category" defaultValue={category} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">wszystkie</option>
            {stats.byCategory.map((c) => (
              <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
            ))}
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
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-12">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide">Pytanie</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-32">Kategoria</th>
              {!isEcom && (
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-32">Budynek</th>
              )}
              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600 uppercase tracking-wide w-20">Trafienia</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600 uppercase tracking-wide w-32">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isEcom ? 5 : 6} className="px-4 py-8 text-center text-slate-400">
                  Brak wyników — zmień filtry.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${!r.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {r.sourceQuestionNum ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.question}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.answer}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {r.category}
                    </span>
                  </td>
                  {!isEcom && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${SCOPE_COLOR[r.scope] ?? 'bg-slate-100 text-slate-700'}`}>
                        {SCOPE_LABEL[r.scope] ?? r.scope}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-xs text-slate-500 font-mono">
                    {r.hitCount?.toString() ?? '0'}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <FaqRowActions id={r.id} isActive={r.isActive ?? true} question={r.question} />
                    ) : (
                      <span className="text-xs text-slate-400">tylko podgląd</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatGroup({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <Badge key={i.label} variant="secondary" className="font-normal">
            {i.label} <span className="ml-1.5 text-slate-500">{i.count}</span>
          </Badge>
        ))}
      </div>
    </div>
  )
}
