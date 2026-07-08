'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Users,
  Package,
  ShoppingCart,
  Settings,
  MessageCircle,
  Mail,
  LayoutDashboard,
  AlertTriangle,
  HelpCircle,
  GraduationCap,
  Coins,
  Undo2,
  X,
  Megaphone,
  Building2,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/poczta', label: 'Poczta', icon: Mail },
  { href: '/conversations', label: 'Konwersacje', icon: MessageCircle },
  { href: '/escalations', label: 'Eskalacje', icon: AlertTriangle },
  { href: '/products', label: 'Produkty', icon: Package },
  { href: '/orders', label: 'Zamówienia', icon: ShoppingCart },
  { href: '/zwroty', label: 'Zwroty Allegro', icon: Undo2 },
  { href: '/promo', label: 'Pasek promo', icon: Megaphone },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
  { href: '/faq-nauka', label: 'Nauka FAQ', icon: GraduationCap },
  { href: '/billing', label: 'Koszty', icon: Coins },
]

const adminItems = [
  { href: '/settings/users', label: 'Użytkownicy', icon: Users },
  { href: '/settings', label: 'Ustawienia', icon: Settings },
]

type SidebarProps = {
  role: string
  open: boolean
  onClose: () => void
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname()

  const content = (
    <>
      <div className="flex items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-[15px] text-white">EtinBOT</span>
        </Link>
        <button
          onClick={onClose}
          className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={<Icon className="h-[18px] w-[18px]" />}
              active={active}
              onClick={onClose}
            />
          )
        })}

        {(role === 'SUPERADMIN' || role === 'OWNER') && (
          <>
            <div className="pt-5 pb-1.5 px-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Admin
              </span>
            </div>
            {role === 'SUPERADMIN' && (
              <NavLink
                href="/clients"
                label="Klienci"
                icon={<Building2 className="h-[18px] w-[18px]" />}
                active={pathname.startsWith('/clients')}
                onClick={onClose}
              />
            )}
            {adminItems.map(({ href, label, icon: Icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={<Icon className="h-[18px] w-[18px]" />}
                active={pathname.startsWith(href)}
                onClick={onClose}
              />
            ))}
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="px-3 text-[11px] text-slate-500">
          EtinBOT &copy; {new Date().getFullYear()}
        </div>
      </div>
    </>
  )

  return (
    <>
      <aside className="hidden md:flex flex-col w-[220px] min-h-screen shrink-0" style={{ background: 'linear-gradient(180deg, #1a1c2c 0%, #11131f 100%)' }}>
        {content}
      </aside>

      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col shadow-xl animate-in slide-in-from-left duration-200" style={{ background: 'linear-gradient(180deg, #1a1c2c 0%, #11131f 100%)' }}>
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
        'relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-indigo-400" />
      )}
      {icon}
      {label}
    </Link>
  )
}
