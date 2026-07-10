'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Trash2, Loader2, AlertTriangle } from 'lucide-react'

import { deleteTenant } from '@/actions/offboarding'

export function DangerZone({ slug, active }: { slug: string; active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmText, setConfirmText] = useState('')

  const expected = `USUŃ ${slug}`
  const canDelete = !active && confirmText === expected

  const doDelete = () =>
    startTransition(async () => {
      const r = await deleteTenant(slug, confirmText)
      if (r.ok) {
        const total = Object.values(r.deleted).reduce((a, b) => a + b, 0)
        toast.success(`Tenant usunięty — skasowano ${total} rekordów w ${Object.keys(r.deleted).length} tabelach.`)
        router.push('/clients')
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/40">
      <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <h3 className="text-sm font-semibold text-red-700">Strefa niebezpieczna</h3>
      </div>

      <div className="p-4 space-y-6">
        {/* Eksport */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-md">
            <div className="text-sm font-medium text-slate-800">Eksport danych tenanta</div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pełny zrzut JSON (rozmowy, produkty, zamówienia, FAQ, e-maile). Sekrety zamaskowane,
              koszty jako agregat miesięczny. Zrób to przed usunięciem.
            </p>
          </div>
          <a
            href={`/api/offboarding-export?slug=${encodeURIComponent(slug)}`}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            Eksportuj dane tenanta (JSON)
          </a>
        </div>

        <div className="border-t border-red-100" />

        {/* Usunięcie */}
        <div className="space-y-3">
          <div className="max-w-lg">
            <div className="text-sm font-medium text-slate-800">Usuń tenanta i wszystkie dane</div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nieodwracalne. Kasuje wszystkie dane tenanta (rozmowy, wiadomości, produkty, zamówienia,
              FAQ, e-maile, eskalacje). Kont użytkowników nie usuwa — tylko odpina od tenanta.
            </p>
          </div>

          {active ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                title="Najpierw dezaktywuj tenanta — przycisk na górze karty."
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-red-300 text-sm font-medium text-white cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                Usuń tenanta i wszystkie dane
              </button>
              <span className="text-xs text-slate-500">
                Najpierw dezaktywuj tenanta — przycisk „Dezaktywuj” na górze karty.
              </span>
            </div>
          ) : (
            <>
              <div className="max-w-lg">
                <label className="block text-xs text-slate-600 mb-1">
                  Aby potwierdzić, wpisz dokładnie: <code className="bg-white px-1 py-0.5 rounded border border-slate-300 text-red-700 font-mono">{expected}</code>
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={pending}
                  placeholder={expected}
                  autoComplete="off"
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={doDelete}
                disabled={!canDelete || pending}
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Usuń tenanta i wszystkie dane
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
