import { cache } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// ============================================================
// Role hierarchy
// ============================================================
//   SUPERADMIN (4)  — devops, pełen dostęp
//   OWNER      (3)  — właściciel obiektu (brat), pełen dostęp + zarządzanie userami
//   EDITOR     (2)  — recepcja, edytuje FAQ/apartamenty/eskalacje, BEZ settings
//   VIEWER     (1)  — tylko podgląd, bez edycji
//
// Rola ustawia PRESET granularnych uprawnień (lib/permissions.ts) — od
// 08.2026 to permissions.hasPermission()/assertPermissionOrFail() są
// właściwym mechanizmem kontroli dostępu w akcjach/stronach. hasRole/
// requireRole/assertRoleOrFail zostają jako narzędzie niższego poziomu
// (hierarchia ról) — używane tam, gdzie liczy się sam poziom roli, nie
// konkretne uprawnienie modułu.
// ============================================================

export type AppRole = 'SUPERADMIN' | 'OWNER' | 'EDITOR' | 'VIEWER'

const ROLE_LEVEL: Record<AppRole, number> = {
  SUPERADMIN: 4,
  OWNER: 3,
  EDITOR: 2,
  VIEWER: 1,
}

export function hasRole(current: string | undefined | null, min: AppRole): boolean {
  if (!current || !(current in ROLE_LEVEL)) return false
  return ROLE_LEVEL[current as AppRole] >= ROLE_LEVEL[min]
}

// ============================================================
// Sesja świeża względem DB (sessionVersion)
// ============================================================
// Zmiana roli/uprawnień/reset hasła (actions/users.ts) inkrementuje
// admin_users.session_version. JWT niesie sessionVersion z chwili logowania
// — jeśli nie zgadza się z DB, JWT jest przeterminowany (stara rola mogła
// żyć w tokenie do 30 dni — to był bug: userka awansowana z VIEWER na
// EDITOR nie mogła korzystać z nowych uprawnień bez ponownego logowania).
// Traktujemy mismatch jak brak sesji.
//
// cache() (React) = jedno zapytanie DB per request/akcję niezależnie ile
// razy getFreshSessionUser() zostanie wywołane (guardy w akcjach, layout,
// permissions.ts — wszystkie dzielą ten sam wynik).

export type FreshAdminUser = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  clientId: string | null
  sessionVersion: number
  permissions: unknown
}

const fetchAdminUserByEmail = cache(async (email: string): Promise<FreshAdminUser | null> => {
  return prisma.adminUser.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      clientId: true,
      sessionVersion: true,
      permissions: true,
    },
  })
})

/**
 * DB-fresh user — null gdy: brak sesji, konto nieaktywne, LUB sessionVersion
 * z JWT nie zgadza się z DB (sesja przeterminowana przez zmianę roli/
 * uprawnień/reset hasła). Token bez pola sessionVersion (stare sesje sprzed
 * migracji) liczy się jako 0 — brak masowego wylogowania przy deployu.
 */
export const getFreshSessionUser = cache(async (): Promise<FreshAdminUser | null> => {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return null
  const fresh = await fetchAdminUserByEmail(email)
  if (!fresh || !fresh.isActive) return null
  const tokenVersion = session.user.sessionVersion ?? 0
  const dbVersion = fresh.sessionVersion ?? 0
  if (tokenVersion !== dbVersion) return null
  return fresh
})

/** Pobierz aktualną rolę usera — DB-fresh (patrz getFreshSessionUser). */
export async function getCurrentRole(): Promise<AppRole | null> {
  const fresh = await getFreshSessionUser()
  if (!fresh?.role || !(fresh.role in ROLE_LEVEL)) return null
  return fresh.role as AppRole
}

// ============================================================
// Server-side guards
// ============================================================

export async function requireAuth() {
  const session = await auth()
  if (!session) redirect('/login')
  // Sesja istnieje wg NextAuth, ale sessionVersion mógł zostać przez admina
  // unieważniony (zmiana roli/uprawnień/reset hasła) — wymuś realne
  // wylogowanie (czyszczenie cookie), inaczej middleware odbije z /login
  // z powrotem do środka (JWT wciąż podpisany i ważny czasowo).
  const fresh = await getFreshSessionUser()
  if (!fresh) redirect('/api/auth/session-expired')
  return session
}

/** Throw redirect na /. Server actions powinny zwracać error zamiast redirect. */
export async function requireRole(min: AppRole) {
  const session = await requireAuth()
  const role = await getCurrentRole()
  if (!hasRole(role, min)) {
    redirect('/')
  }
  return { session, role: role! }
}

/** Dla akcji destrukcyjnych — zwraca {ok:false} zamiast redirect. */
export async function assertRoleOrFail(min: AppRole): Promise<
  | { ok: true; role: AppRole }
  | { ok: false; message: string }
> {
  const role = await getCurrentRole()
  if (!hasRole(role, min)) {
    return { ok: false, message: `Brak uprawnień (wymagane: ${min}, masz: ${role ?? 'brak'})` }
  }
  return { ok: true, role: role! }
}

/** Legacy alias — używany w settings/users. */
export async function requireAdmin() {
  return requireRole('OWNER')
}

export function isAdmin(role: string) {
  return hasRole(role, 'OWNER')
}

// ============================================================
// API guards (webhooks etc.)
// ============================================================

export async function requireApiAuth(req: NextRequest): Promise<{ userId?: string; source: 'webhook' | 'voice' | 'session' }> {
  const webhookSecret = req.headers.get('x-webhook-secret')
  const voiceSecret = req.headers.get('x-voice-secret')

  if (process.env.WEBHOOK_SECRET && webhookSecret === process.env.WEBHOOK_SECRET) {
    return { source: 'webhook' }
  }

  if (process.env.VOICE_BOT_SECRET && voiceSecret === process.env.VOICE_BOT_SECRET) {
    const agentId = req.headers.get('x-agent-id')
    if (agentId) {
      const user = await prisma.adminUser.findUnique({ where: { id: agentId } })
      if (user) return { userId: user.id, source: 'voice' }
    }
    return { source: 'voice' }
  }

  const session = await auth()
  if (!session?.user?.email) {
    throw { error: 'Unauthorized', status: 401 }
  }
  const user = await prisma.adminUser.findUnique({ where: { email: session.user.email } })
  if (!user) {
    throw { error: 'User not found', status: 401 }
  }
  return { userId: user.id, source: 'session' }
}
