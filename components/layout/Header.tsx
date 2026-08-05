'use client'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Menu, LogOut } from 'lucide-react'

type HeaderProps = {
  tenantSelector?: React.ReactNode
  user: {
    name?: string | null
    email?: string | null
    role: string
  }
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

export function Header({ user, tenantSelector, onMenuToggle }: HeaderProps) {
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'
  const avatarColor = getAvatarColor(user.name ?? 'User')

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="md:hidden font-semibold text-gray-900">EtinBOT</div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {tenantSelector}
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
          className="text-gray-400 hover:text-gray-700 h-8 w-8 p-0"
          title="Wyloguj"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
