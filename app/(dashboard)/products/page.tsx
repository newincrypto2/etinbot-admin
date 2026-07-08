import Link from 'next/link'

import { requireAuth } from '@/lib/auth-helpers'
import { getProductStats, listProducts, findAttr } from '@/queries/products'
import { fmtFullDateTime } from '@/lib/datetime'
import { SyncButton } from '@/components/SyncButton'
import { triggerProductSync } from '@/actions/products'
import { activeClientSlug } from '@/lib/tenant'

const PAGE_SIZE = 50

type SearchParams = Promise<{ q?: string; stock?: string; page?: string }>

function stripHtml(s: string | null): string {
  if (!s) return ''
  return s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export default async function ProductsPage(props: { searchParams: SearchParams }) {
  await requireAuth()
  const params = await props.searchParams
  const search = params.q?.trim() ?? ''
  const stock = params.stock ?? 'all'
  const page = Math.max(1, Number(params.page) || 1)

  const [stats, result] = await Promise.all([
    getProductStats((await activeClientSlug())),
    listProducts({ clientSlug: (await activeClientSlug()), search, stock, page, pageSize: PAGE_SIZE }),
  ])

  const { rows, total, pageSize } = result
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const qs = (overrides: Record<string, string | number>) => {
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (stock !== 'all') sp.set('stock', stock)
    for (const [k, v] of Object.entries(overrides)) sp.set(k, String(v))
    const s = sp.toString()
    return s ? `?${s}` : ''
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Produkty</h1>
          <p className="text-sm text-slate-500 mt-1">
            Zsynchronizowane z WooCommerce. W bazie: <strong>{stats.total}</strong> aktywnych produktów.
          </p>
        </div>
        <SyncButton action={triggerProductSync} idleLabel="Synchronizuj z WooCommerce" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Wszystkie" value={stats.total} />
        <StatCard label="Dostępne" value={stats.inStock} color="green" />
        <StatCard label="Na zamówienie" value={stats.onBackorder} color="yellow" />
        <StatCard label="Brak na stanie" value={stats.outOfStock} color="red" />
      </div>

      {/* Filtry */}
      <form className="flex flex-wrap gap-2 items-end p-4 rounded-lg border border-slate-200 bg-white">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">Szukaj</label>
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="nazwa, SKU, ID"
            className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Stan</label>
          <select name="stock" defaultValue={stock} className="h-9 px-3 rounded-md border border-slate-300 text-sm">
            <option value="all">wszystkie</option>
            <option value="instock">dostępne</option>
            <option value="onbackorder">na zamówienie</option>
            <option value="outofstock">brak na stanie</option>
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          Filtruj
        </button>
      </form>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Produkt</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Cena</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Stan</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Kategorie</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => {
              const desc = stripHtml(p.shortDescription)
              const kraj = findAttr(p.attributes, 'kraj')
              const sklad = findAttr(p.attributes, 'skład', 'sklad', 'składnik')
              return (
                <tr key={p.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          {p.url ? (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {p.name}
                            </a>
                          ) : (
                            p.name
                          )}
                        </div>
                        <div className="text-xs text-slate-400">ID: {p.extId}</div>
                        {(kraj || sklad) && (
                          <div className="text-xs text-slate-500 mt-1 space-y-0.5 max-w-md">
                            {kraj && <div><span className="text-slate-400">Kraj:</span> {kraj}</div>}
                            {sklad && <div className="line-clamp-1"><span className="text-slate-400">Skład:</span> {sklad}</div>}
                          </div>
                        )}
                        {desc && <div className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-md">{desc}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.variants.length > 0 ? (
                      <div>
                        <span className="font-medium whitespace-nowrap">
                          {p.pricePln != null ? `od ${p.pricePln.toFixed(2)} PLN` : '—'}
                        </span>
                        <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                          {p.variants.map((v, i) => (
                            <div key={i} className="whitespace-nowrap">
                              {v.label}: {v.pricePln != null ? `${v.pricePln.toFixed(2)} PLN` : '—'}
                              {v.salePricePln && <span className="text-green-600"> (promo {v.salePricePln.toFixed(2)})</span>}
                              {v.stockStatus === 'outofstock' && <span className="text-red-500"> · brak</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="whitespace-nowrap">
                        <span className="font-medium">{p.pricePln != null ? `${p.pricePln.toFixed(2)} PLN` : '—'}</span>
                        {p.salePricePln && (
                          <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            promo {p.salePricePln.toFixed(2)} PLN
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge status={p.stockStatus} qty={p.stockQty} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {p.categories.join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {p.lastSyncedAt ? fmtFullDateTime(p.lastSyncedAt) : '—'}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  {total === 0 && !search
                    ? 'Brak zsynchronizowanych produktów. Sync uruchomi się automatycznie o 03:00.'
                    : 'Brak wyników — zmień filtry.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacja */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div>
            {from}–{to} z {total}
          </div>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={qs({ page: page - 1 })} className="h-8 px-3 inline-flex items-center rounded-md border border-slate-300 hover:bg-slate-50">
                ← Poprzednia
              </Link>
            ) : (
              <span className="h-8 px-3 inline-flex items-center rounded-md border border-slate-200 text-slate-300">← Poprzednia</span>
            )}
            <span className="text-xs text-slate-500">strona {page} / {totalPages}</span>
            {page < totalPages ? (
              <Link href={qs({ page: page + 1 })} className="h-8 px-3 inline-flex items-center rounded-md border border-slate-300 hover:bg-slate-50">
                Następna →
              </Link>
            ) : (
              <span className="h-8 px-3 inline-flex items-center rounded-md border border-slate-200 text-slate-300">Następna →</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClass =
    color === 'green' ? 'text-green-600'
    : color === 'red' ? 'text-red-600'
    : color === 'yellow' ? 'text-yellow-600'
    : 'text-slate-900'
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}

function StockBadge({ status, qty }: { status: string | null; qty: number | null }) {
  if (status === 'outofstock') {
    return <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full whitespace-nowrap">Brak</span>
  }
  if (status === 'onbackorder') {
    return <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full whitespace-nowrap">Na zamówienie</span>
  }
  return (
    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">
      {qty !== null ? `${qty} szt.` : 'Dostępny'}
    </span>
  )
}
