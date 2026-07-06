import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { fmtFullDateTime } from '@/lib/datetime'
import { PromoRowActions } from './_components/PromoRowActions'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

export default async function PromoPage() {
  await requireAuth()
  const client = await prisma.clients.findUnique({ where: { slug: CLIENT_SLUG }, select: { id: true } })
  if (!client) return <div className="p-8 text-slate-500">Brak danych klienta.</div>

  const bars = await prisma.promo_bars.findMany({
    where: { client_id: client.id },
    orderBy: [{ enabled: 'desc' }, { priority: 'desc' }, { updated_at: 'desc' }],
    take: 100,
  })
  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold inline-flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-indigo-500" /> Pasek promo
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Pasek promocyjny nad stroną sklepu (własne zastępstwo Trustisto): treść, kolory, zegar,
            kod rabatowy, harmonogram i targeting stron. Przy kilku aktywnych wygrywa wyższy priorytet.
          </p>
        </div>
        <Link href="/promo/new" className="h-9 px-3 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Nowa kampania
        </Link>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Kampania</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Zegar</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Harmonogram</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Wyśw. / Klik.</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bars.map((b) => {
              const colors = (typeof b.colors === 'string' ? JSON.parse(b.colors as string) : b.colors) as Record<string, string>
              const scheduledOff = (b.starts_at && b.starts_at > now) || (b.ends_at && b.ends_at < now)
              const timerDone = b.timer_ends_at && b.timer_ends_at < now
              return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded" style={{ background: colors?.bg ?? '#2e7d32' }} />
                      <div>
                        <div className="font-medium text-slate-900">{b.name}</div>
                        <div className="text-xs text-slate-400 max-w-md truncate">{b.text}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {b.enabled ? (
                      scheduledOff ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">poza harmonogramem</span>
                      ) : timerDone && b.hide_after_end ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">zegar minął (ukryty)</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">aktywny</span>
                      )
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">wyłączony</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {b.timer_ends_at ? `do ${fmtFullDateTime(b.timer_ends_at)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {b.starts_at || b.ends_at
                      ? `${b.starts_at ? fmtFullDateTime(b.starts_at) : '…'} → ${b.ends_at ? fmtFullDateTime(b.ends_at) : '…'}`
                      : 'ciągły'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-slate-600">
                    {String(b.views)} / {String(b.clicks)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <PromoRowActions id={b.id} enabled={b.enabled} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {bars.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  Brak kampanii. Kliknij „Nowa kampania", ustaw treść i kolory, włącz przełącznikiem —
                  pasek pojawi się na stronie w ciągu ~1 minuty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
        <div className="font-medium text-slate-700">Wdrożenie na stronę (raz):</div>
        <code className="block bg-white rounded border border-slate-200 px-3 py-2 font-mono text-[11px] overflow-x-auto">
          {'<script src="https://etinbot.dewflow.cloud/api/promobar/widget.js" data-site="krainaherbaty" defer></script>'}
        </code>
        <div>Pasek sam pilnuje harmonogramu, zegara i wykluczeń — nie trzeba nic zdejmować ręcznie.</div>
      </div>
    </div>
  )
}
