import Link from 'next/link'
import { Plus } from 'lucide-react'

import { requirePermission } from '@/lib/permissions'
import { listClients } from '@/queries/clients'
import { fmtDateLong } from '@/lib/datetime'
import { ClientRowActions } from './_components/ClientRowActions'
import { ChannelBadges } from './_components/ChannelBadges'

export default async function ClientsPage() {
  await requirePermission('clients.manage')
  const clients = await listClients()

  const active = clients.filter((c) => c.active).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Klienci</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tenanci platformy EtinBOT. Aktywnych: <strong>{active}</strong> z {clients.length}.
          </p>
        </div>
        <Link
          href="/clients/new"
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Nowy klient
        </Link>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nazwa</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Typ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Kanały</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Rozmowy 7 dni</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Utworzony</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 align-middle">
                <td className="px-4 py-3">
                  <Link href={`/clients/${c.slug}`} className="font-medium text-slate-900 hover:underline">
                    {c.name}
                  </Link>
                  <div className="text-xs text-slate-400">{c.slug}</div>
                </td>
                <td className="px-4 py-3">
                  {c.vertical === 'ecommerce' ? (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">e-commerce</span>
                  ) : c.vertical === 'rental' ? (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">rental</span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ChannelBadges channels={c.channels} />
                </td>
                <td className="px-4 py-3 text-slate-700">{c.conversations7d}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateLong(c.createdAt)}</td>
                <td className="px-4 py-3">
                  {c.active ? (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Aktywny</span>
                  ) : (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Nieaktywny</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ClientRowActions slug={c.slug} active={c.active} />
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  Brak tenantów. Dodaj pierwszego przyciskiem „Nowy klient”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
