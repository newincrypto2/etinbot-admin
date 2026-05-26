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

/** Pobierz aktualną rolę usera — JWT lub DB fallback. */
export async function getCurrentRole(): Promise<AppRole | null> {
  const session = await auth()
  if (!session?.user) return null

  // JWT może być stary (sprzed migracji ról) — fallback do DB.
  const jwtRole = session.user.role
  if (jwtRole && jwtRole in ROLE_LEVEL) return jwtRole as AppRole

  if (!session.user.email) return null
  const fresh = await prisma.adminUser.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  if (fresh?.role && fresh.role in ROLE_LEVEL) return fresh.role as AppRole
  return null
}

// ============================================================
// Server-side guards
// ============================================================

export async function requireAuth() {
  const session = await auth()
  if (!session) redirect('/login')
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
