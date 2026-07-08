'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Przełączenie aktywnego tenanta (tylko konta bez przypisanego clientId = SUPERADMIN). */
export async function setActiveTenant(slug: string): Promise<{ ok: boolean; message: string }> {
  const session = await auth()
  if (!session?.user) return { ok: false, message: 'Brak sesji' }
  const role = (session.user as { role?: string }).role
  const userClientId = (session.user as { clientId?: string | null }).clientId
  if (userClientId || role !== 'SUPERADMIN') {
    return { ok: false, message: 'Twoje konto jest przypisane do jednego klienta' }
  }
  const c = await prisma.clients.findUnique({ where: { slug }, select: { slug: true, name: true } })
  if (!c) return { ok: false, message: `Tenant '${slug}' nie istnieje` }
  const jar = await cookies()
  jar.set('active_client_slug', c.slug, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath('/', 'layout')
  return { ok: true, message: `Przełączono na: ${c.name}` }
}
