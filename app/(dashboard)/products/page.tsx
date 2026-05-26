import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export default async function ProductsPage() {
  await requireAuth()

  const clientId = process.env.CLIENT_ID!
  const products = await prisma.products.findMany({
    where: { client_id: clientId, is_active: true },
    orderBy: { name: 'asc' },
    take: 100,
  })

  const inStock = products.filter(p => p.stock_status !== 'outofstock').length
  const outOfStock = products.filter(p => p.stock_status === 'outofstock').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Produkty</h1>
        <p className="text-sm text-slate-500 mt-1">
          Zsynchronizowane z WooCommerce ({products.length} aktywnych, {inStock} dostepnych, {outOfStock} brak na stanie)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Produkty" value={products.length} />
        <StatCard label="Dostepne" value={inStock} color="green" />
        <StatCard label="Brak na stanie" value={outOfStock} color="red" />
      </div>

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
            {products.map(p => (
              <tr key={String(p.id)} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                    )}
                    <div>
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-400">ID: {p.ext_id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium">{p.price_pln?.toString()} PLN</span>
                  {p.sale_price_pln && (
                    <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      promo {p.sale_price_pln.toString()} PLN
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StockBadge status={p.stock_status} qty={p.stock_qty} />
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {(p.categories || []).join(', ') || '-'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {p.last_synced_at ? new Date(p.last_synced_at).toLocaleString('pl-PL') : '-'}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  Brak zsynchronizowanych produktow. Sync uruchomi sie automatycznie o 03:00.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClass = color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-slate-900'
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}

function StockBadge({ status, qty }: { status: string | null; qty: number | null }) {
  if (status === 'outofstock') {
    return <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Brak</span>
  }
  if (status === 'onbackorder') {
    return <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Na zamowienie</span>
  }
  return (
    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
      {qty !== null ? `${qty} szt.` : 'Dostepny'}
    </span>
  )
}
