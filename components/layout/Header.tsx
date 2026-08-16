'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Menu, LogOut, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ModuleId } from '@/lib/modules'
import { buildFlatNavItems, type NavItem } from './nav'

type HeaderProps = {
  user: {
    name?: string | null
    email?: string | null
    role: string
  }
  modules: Record<ModuleId, boolean>
  permissions: Record<string, boolean>
  onMenuToggle: () => void
}

const AVATAR_COLORS = [
  { bg: '#EBF5FF', fg: '#0070F3' },
  { bg: '#F3E8FF', fg: '#7E22CE' },
  { bg: '#FFF7ED', fg: '#C2410C' },
  { bg: '#F0FDF4', fg: '#15803D' },
  { bg: '#FEF2F2', fg: '#991B1B' },
  { bg: '#ECFDF5', fg: '#047857' },
  { bg: '#EFF6FF', fg: '#1D4ED8' },
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Tytuł strony wyprowadzony z pathname + rejestru menu (te same dane co
// Sidebar/paleta). Dopasowanie po najdłuższym pasującym prefiksie href, żeby
// podstrony (np. /conversations/[id]) trafiały na etykietę modułu-rodzica.
// Fallbacki poniżej łapią trasy spoza rejestru (np. /clients gdy user nie ma
// clients.manage, ale i tak tam trafił jako SUPERADMIN z innego linku).
const TITLE_FALLBACKS: Record<string, string> = {
  '/clients': 'Klienci',
  '/settings/users': 'Użytkownicy',
  '/settings': 'Ustawienia',
  '/konto': 'Moje konto',
}

function pageTitle(pathname: string, items: NavItem[]): string {
  if (pathname === '/') return 'Dashboard'

  let best: NavItem | null = null
  for (const item of items) {
    if (item.href === '/') continue
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) best = item
    }
  }
  if (best) return best.label

  for (const [prefix, label] of Object.entries(TITLE_FALLBACKS)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label
  }
  return 'Panel'
}

export function Header({ user, modules, permissions, onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = useState(false)

  const flatItems = useMemo(() => buildFlatNavItems(modules, permissions), [modules, permissions])
  const title = useMemo(() => pageTitle(pathname, flatItems), [pathname, flatItems])

  // Skrót Ctrl+K / Cmd+K otwiera paletę nawigacji z dowolnego miejsca panelu.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'
  const avatarColor = getAvatarColor(user.name ?? 'User')

  return (
    <header className="h-14 border-b bg-white flex items-center gap-3 px-4 shrink-0">
      <button
        onClick={onMenuToggle}
        className="md:hidden h-10 w-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h2 className="text-[15px] font-semibold text-gray-900 truncate">{title}</h2>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 min-w-[220px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12.5px] text-gray-500 hover:border-gray-300 hover:bg-gray-100 transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Szukaj w panelu…</span>
          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Szukaj w panelu"
          className="md:hidden h-10 w-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        <Link
          href="/konto"
          title="Moje konto"
          className="hidden sm:flex items-center gap-2.5 rounded-lg px-2 py-1 -mx-1 hover:bg-gray-100 transition-colors"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium" style={{ backgroundColor: avatarColor.bg, color: avatarColor.fg }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 leading-tight">{user.name}</div>
            <div className="text-[11px] text-gray-500 leading-tight">
              {({ SUPERADMIN: 'Superadmin', ADMIN: 'Administrator', OWNER: 'Operator', EDITOR: 'Editor', VIEWER: 'Viewer', AGENT: 'Agent' } as Record<string, string>)[user.role?.toUpperCase?.() ?? ''] ?? user.role}
            </div>
          </div>
        </Link>

        <Link href="/konto" title="Moje konto" className="sm:hidden">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium" style={{ backgroundColor: avatarColor.bg, color: avatarColor.fg }}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-gray-400 hover:text-gray-700 h-10 w-10 p-0"
          title="Wyloguj"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <CommandPalette items={flatItems} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  )
}

function CommandPalette({
  items,
  open,
  onOpenChange,
}: {
  items: NavItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.label.toLowerCase().includes(q))
  }, [items, query])

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 overflow-hidden p-0" showCloseButton={false}>
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) go(filtered[0].href)
            }}
            placeholder="Szukaj strony w panelu…"
            className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Brak wyników</p>
          )}
          {filtered.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => go(item.href)}
                className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {item.label}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
