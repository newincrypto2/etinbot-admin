'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { matchPlan, type ModuleId } from '@/lib/modules'
import { buildNavGroups } from './nav'
import { TenantTile, type TenantTileData } from './TenantTile'

// Menu buduje się z rejestru MODULES (lib/modules.ts + components/layout/nav.ts)
// zamiast dwóch zaszytych na sztywno tablic (navItems/rentalNavItems, stan
// sprzed redesignu 08.2026). WAŻNE — parytet KH: tenant ecommerce bez
// override'ów w config.modules (m.in. KrainaHerbaty) musi widzieć identyczny
// zestaw pozycji jak dawne menu 1:1 — to gwarantuje lib/modules.ts
// (MODULES[].defaultFor), nie zmieniaj filtrowania tutaj bez świadomości,
// że dotyka to produkcji KH.

type SidebarProps = {
  permissions: Record<string, boolean>
  modules: Record<ModuleId, boolean>
  vertical?: string | null
  activeTenant: TenantTileData
  /** Lista tenantów do przełączania w kafelku (tylko SUPERADMIN bez klienta). */
  tenantList: TenantTileData[] | null
  open: boolean
  onClose: () => void
}

const SIDEBAR_GRADIENT = { background: 'linear-gradient(178deg, #16203F 0%, #0E1630 55%)' }

export function Sidebar({ permissions, modules, activeTenant, tenantList, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const groups = buildNavGroups(modules, permissions)
  const plan = matchPlan(modules)
  const planLabel = plan?.label ?? 'Własny zestaw'

  const content = (
    <>
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px] bg-[var(--brand-blue)]">
            <span className="text-sm font-bold text-white">E</span>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Etin<span className="text-[#7FA9F5]">BOT</span>
          </span>
        </Link>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700 hover:text-white md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <TenantTile active={activeTenant} planLabel={planLabel} tenants={tenantList} />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {groups.map((group) => (
          <div key={group.key} className="mt-3.5 first:mt-0.5">
            <span className="block px-2 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#66759C]">
              {group.label}
            </span>
            {group.items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={<item.icon className="h-[18px] w-[18px]" />}
                  active={active}
                  onClick={onClose}
                />
              )
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-white/[0.09] px-4 py-3 text-[12px] text-[#8DA0C9]">
        <span className="relative flex h-[7px] w-[7px] flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-emerald-400" />
        </span>
        Bot aktywny
      </div>
    </>
  )

  return (
    <>
      <aside className="hidden min-h-screen w-[236px] shrink-0 flex-col md:flex" style={SIDEBAR_GRADIENT}>
        {content}
      </aside>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={onClose} />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col shadow-xl duration-200 animate-in slide-in-from-left md:hidden"
            style={SIDEBAR_GRADIENT}
          >
            {content}
          </aside>
        </>
      )}
    </>
  )
}

function NavLink({ href, label, icon, active, onClick }: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative flex min-h-[40px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
        active
          ? 'bg-[rgba(46,124,240,.16)] text-white'
          : 'text-[#B9C4DE] hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {active && (
        <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full bg-[var(--brand-blue)]" />
      )}
      {icon}
      {label}
    </Link>
  )
}
