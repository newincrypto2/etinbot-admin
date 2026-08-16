'use client'

// Kafel tenanta w sidebarze — przeniesiony z headera (TenantSelector.tsx,
// zachowany w repo dla historii/rollbacku, ale nieużywany). Dwa tryby:
//  - switchable (SUPERADMIN bez przypisanego klienta): klikalny, otwiera
//    listę tenantów, przełącza przez tę samą akcję co dawny TenantSelector
//    (setActiveTenant → cookie active_client_slug → router.refresh()).
//  - statyczny (każdy inny user): sam kafel, bez rozwijania.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { setActiveTenant } from '@/actions/tenant'

export type TenantTileData = { slug: string; name: string; vertical: string | null }

// Kolor kafelka deterministyczny z hasha sluga — ten sam tenant zawsze
// dostaje tę samą plakietkę (bez losowości między odświeżeniami/userami).
const TILE_COLORS = ['#2E7CF0', '#7A5AF8', '#0E8A62', '#C2410C', '#0891B2', '#BE185D', '#7C3AED']

function tileColor(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash)
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length]
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

type TenantTileProps = {
  active: TenantTileData
  /** Etykieta pakietu (dopasowana z aktywnych modułów, lib/modules.ts matchPlan). */
  planLabel: string
  /** Lista tenantów do przełączania. null = kafel statyczny, bez rozwijania. */
  tenants: TenantTileData[] | null
}

export function TenantTile({ active, planLabel, tenants }: TenantTileProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const switchable = !!tenants && tenants.length > 1
  const color = tileColor(active.slug)

  const badge = (
    <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
      <span
        className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[8px] text-[12px] font-bold text-white"
        style={{ background: color }}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initialOf(active.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-white leading-tight">
          {active.name}
        </span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-[#8DA0C9] leading-tight">
          {(active.vertical ?? 'ecommerce')} · {planLabel}
        </span>
      </span>
    </span>
  )

  if (!switchable) {
    return (
      <div className="mx-3 mb-2.5 mt-1 flex min-h-[42px] items-center gap-2.5 rounded-[10px] border border-white/[0.09] bg-white/[0.05] px-2.5 py-2">
        {badge}
      </div>
    )
  }

  const onSwitch = (slug: string) => {
    setOpen(false)
    if (slug === active.slug) return
    startTransition(async () => {
      const r = await setActiveTenant(slug)
      if (r.ok) {
        toast.success(r.message)
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <div className="relative mx-3 mb-2.5 mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[42px] w-full items-center gap-2.5 rounded-[10px] border border-white/[0.09] bg-white/[0.05] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed"
      >
        {badge}
        <ChevronDown className="h-3.5 w-3.5 flex-none text-[#66759C]" />
      </button>

      {open && (
        <>
          {/* Klik poza listą zamyka popover — nakładka pod listą (z-20 < z-30). */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label="Wybierz tenanta"
            className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-[10px] border border-white/[0.14] bg-[#101A38] p-1 shadow-2xl"
          >
            {tenants!.map((t) => {
              const selected = t.slug === active.slug
              return (
                <button
                  key={t.slug}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSwitch(t.slug)}
                  className="flex min-h-[40px] w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13px] text-[#C9D3EA] transition-colors hover:bg-white/[0.08]"
                >
                  <span
                    className="grid h-5 w-5 flex-none place-items-center rounded-[6px] text-[10px] font-bold text-white"
                    style={{ background: tileColor(t.slug) }}
                  >
                    {initialOf(t.name)}
                  </span>
                  <span className={selected ? 'font-semibold text-white' : ''}>{t.name}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
