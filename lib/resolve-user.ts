import { prisma } from '@/lib/prisma'

/**
 * Resolve DB user from session data.
 * JWT may hold stale ID after DB reseed — fallback to email lookup.
 */
export async function resolveUserId(session: {
  user: { id: string; email?: string | null }
}): Promise<string | null> {
  const byId = await prisma.adminUser.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  })
  if (byId) return byId.id

  if (session.user.email) {
    const byEmail = await prisma.adminUser.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (byEmail) return byEmail.id
  }

  return null
}
