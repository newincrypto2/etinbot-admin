import Link from 'next/link'
import { Shield, User as UserIcon, UserPlus, Eye, ArrowLeft } from 'lucide-react'

import { requireAdmin } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { AddUserForm } from './_components/AddUserForm'
import { UserRowActions } from './_components/UserRowActions'

const ROLE_META: Record<string, { label: string; color: string; icon: 'shield' | 'user' | 'eye' }> = {
  SUPERADMIN: { label: 'Superadmin', color: 'bg-indigo-100 text-indigo-700', icon: 'shield' },
  OWNER:      { label: 'Operator',   color: 'bg-purple-100 text-purple-700', icon: 'shield' },
  EDITOR:     { label: 'Editor',     color: 'bg-emerald-100 text-emerald-700', icon: 'user' },
  VIEWER:     { label: 'Viewer',     color: 'bg-slate-100 text-slate-700', icon: 'eye' },
}

export default async function UsersPage() {
  await requireAdmin()

  const session = await auth()
  const currentEmail = session?.user?.email ?? null

  const users = await prisma.adminUser.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do ustawień
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Użytkownicy panelu</h1>
        <p className="text-sm text-slate-600 mt-1">
          Konta dostępne do logowania w panelu administracyjnym. Każdy ma rolę określającą zakres uprawnień.
        </p>
      </header>

      {/* Add user form */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Dodaj użytkownika</h2>
        </div>
        <AddUserForm />
      </div>

      {/* Users list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            Aktywni i nieaktywni ({users.length})
          </h2>
        </div>

        {users.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Brak użytkowników. Dodaj pierwszego powyżej.
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {users.map((user) => {
              const meta = ROLE_META[user.role] ?? ROLE_META.VIEWER
              const isCurrent = currentEmail === user.email
              const Icon = meta.icon === 'shield' ? Shield : meta.icon === 'eye' ? Eye : UserIcon
              return (
                <div
                  key={user.id}
                  className={`flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 ${!user.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 flex items-center gap-2">
                        {user.name}
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium uppercase">
                            to Ty
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant="secondary" className={`text-[11px] ${meta.color}`}>
                      {meta.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${user.isActive ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-600 border-red-200 bg-red-50'}`}
                    >
                      {user.isActive ? 'aktywny' : 'nieaktywny'}
                    </Badge>
                    <UserRowActions
                      user={{
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        isActive: user.isActive,
                      }}
                      isCurrentUser={isCurrent}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Role legend */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
        <div className="font-medium text-slate-700 text-sm mb-2">Role:</div>
        <div><strong>Superadmin</strong> — pełen dostęp, w tym Settings + Users + integracje API</div>
        <div><strong>Operator</strong> — właściciel obiektu (brat). Pełen dostęp + zarządzanie userami</div>
        <div><strong>Editor</strong> — recepcja. Edytuje FAQ, apartamenty, eskalacje. Bez Settings</div>
        <div><strong>Viewer</strong> — podgląd dashboard + lista konwersacji. Bez edycji</div>
      </div>
    </div>
  )
}
