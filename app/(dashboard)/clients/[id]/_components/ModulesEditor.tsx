'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  Save,
  Lock,
  Mail,
  MessageCircle,
  AlertTriangle,
  Package,
  ShoppingCart,
  PackagePlus,
  Undo2,
  Calculator,
  Megaphone,
  BedDouble,
  CalendarCheck,
  HelpCircle,
  GraduationCap,
  Coins,
  type LucideIcon,
} from 'lucide-react'

import { saveClientModules } from '@/actions/client-config'
import {
  MODULES,
  MODULE_GROUP_ORDER,
  MODULE_GROUP_LABELS,
  MODULE_PLANS,
  resolveModules,
  matchPlan,
  type ModuleId,
  type ModuleOverrides,
} from '@/lib/modules'

// Ikony modułów mapowane po nazwie z lib/modules.ts (pole `icon`).
const ICONS: Record<string, LucideIcon> = {
  Mail,
  MessageCircle,
  AlertTriangle,
  Package,
  ShoppingCart,
  PackagePlus,
  Undo2,
  Calculator,
  Megaphone,
  BedDouble,
  CalendarCheck,
  HelpCircle,
  GraduationCap,
  Coins,
}

const INTEGRATION_LABELS: Record<string, string> = {
  woocommerce: 'WooCommerce',
  baselinker: 'BaseLinker',
  allegro: 'Allegro',
  idobooking: 'IdoBooking',
}

export function ModulesEditor({
  slug,
  vertical,
  initialOverrides,
  integrations,
}: {
  slug: string
  vertical: string | null
  initialOverrides: ModuleOverrides
  /** Stan integracji odczytany tanio z configu (bez wywołania backendu) — tylko klucze policzalne. */
  integrations: { woocommerce: boolean; baselinker: boolean; allegro: boolean }
}) {
  const [state, setState] = useState<Record<ModuleId, boolean>>(() => resolveModules(vertical, initialOverrides))
  const [pending, startTransition] = useTransition()

  const activePlanId = useMemo(() => matchPlan(state)?.id ?? null, [state])

  const toggle = (id: ModuleId) => {
    setState((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const applyPlan = (planId: string) => {
    const plan = MODULE_PLANS.find((p) => p.id === planId)
    if (!plan) return
    setState(resolveModules(vertical, plan.modules))
  }

  const save = () => {
    startTransition(async () => {
      const r = await saveClientModules(slug, vertical, state)
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
    })
  }

  const integrationOk = (key?: string): boolean | null => {
    if (key === 'woocommerce') return integrations.woocommerce
    if (key === 'baselinker') return integrations.baselinker
    if (key === 'allegro') return integrations.allegro
    return null // idobooking i inne — status nieznany tanim kosztem, sam chip wystarczy
  }

  return (
    <div className="bg-white rounded-lg border p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Moduły</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-2xl">
          Pakiet ustawia stan startowy, każdy moduł można potem przełączyć osobno. Wyłączony moduł
          znika z menu tenanta i jego strony przestają działać w bocie.
        </p>
      </div>

      {/* Pigułki pakietów */}
      <div className="flex flex-wrap gap-2">
        {MODULE_PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.description}
            onClick={() => applyPlan(p.id)}
            className={`h-8 px-3.5 rounded-full text-xs font-medium border transition-colors ${
              activePlanId === p.id
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
            }`}
          >
            {p.label}
          </button>
        ))}
        {activePlanId === null && (
          <span className="h-8 px-3.5 inline-flex items-center rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
            Zestaw własny
          </span>
        )}
      </div>

      {/* Grupy modułów */}
      <div className="space-y-5">
        {MODULE_GROUP_ORDER.map((group) => {
          const rows = MODULES.filter((m) => m.group === group)
          if (!rows.length) return null
          return (
            <div key={group}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {MODULE_GROUP_LABELS[group]}
              </h4>
              <div className="space-y-2">
                {rows.map((m) => {
                  const Icon = ICONS[m.icon] ?? Package
                  const on = m.core ? true : state[m.id]
                  const ok = integrationOk(m.integration)
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 rounded-md border border-slate-200 px-3.5 py-2.5 ${
                        !on && !m.core ? 'opacity-60' : ''
                      }`}
                    >
                      <span className="h-8 w-8 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{m.label}</span>
                          <span className="text-[11px] font-mono text-slate-400">{m.id}</span>
                          {m.integration && (
                            <span className="text-[10px] font-mono bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-500">
                              wymaga: {INTEGRATION_LABELS[m.integration] ?? m.integration}
                              {ok === false && ' · brak'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                      </div>
                      <div className="ml-auto shrink-0">
                        {m.core ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Lock className="h-3.5 w-3.5" /> zawsze włączony
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={`Przełącz moduł ${m.label}`}
                            onClick={() => toggle(m.id)}
                            className={`relative h-[22px] w-[38px] rounded-full transition-colors ${
                              on ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all ${
                                on ? 'left-[19px]' : 'left-[3px]'
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Zapisz moduły
      </button>
    </div>
  )
}
