import { cache } from 'react'
import { cookies } from 'next/headers'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Aktywny tenant panelu (S1, multi-tenant — SAAS-READINESS-PLAN):
 * 1. Konto z przypisanym clientId (OWNER/EDITOR/VIEWER klienta) → ZAWSZE jego tenant.
 * 2. Konto bez przypisania (SUPERADMIN) → selektor: cookie `active_client_slug`
 *    → env CLIENT_SLUG (kompatybilność wstecz) → pierwszy tenant z DB.
 *
 * cache() = jedna ewaluacja per request (server components + actions).
 */
export type ActiveClient = { id: string; slug: string; name: string; vertical: string | null }

const SELECT = { id: true, slug: true, name: true, vertical: true } as const

export const activeClient = cache(async (): Promise<ActiveClient> => {
  const session = await auth()
  if (!session?.user) throw new Error('Brak sesji — zaloguj się ponownie')
  const userClientId = (session.user as { clientId?: string | null }).clientId
  if (userClientId) {
    const c = await prisma.clients.findUnique({ where: { id: userClientId }, select: SELECT })
    if (!c) throw new Error('Tenant przypisany do Twojego konta nie istnieje — skontaktuj się z administratorem')
    return c
  }
  const jar = await cookies()
  const wanted = jar.get('active_client_slug')?.value || process.env.CLIENT_SLUG
  if (wanted) {
    const c = await prisma.clients.findUnique({ where: { slug: wanted }, select: SELECT })
    if (c) return c
  }
  const first = await prisma.clients.findFirst({ orderBy: { created_at: 'asc' }, select: SELECT })
  if (!first) throw new Error('Brak tenantów w bazie')
  return first
})

export async function activeClientId(): Promise<string> {
  return (await activeClient()).id
}

export async function activeClientSlug(): Promise<string> {
  return (await activeClient()).slug
}

/** @deprecated kompatybilność wstecz — użyj activeClientId() */
export const panelClientId = activeClientId
