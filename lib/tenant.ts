import { prisma } from '@/lib/prisma'

/**
 * Tenant tego wdrożenia panelu (współdzielona DB — panel widzi TYLKO swój tenant).
 * FAIL-CLOSED: brak env CLIENT_SLUG lub nieznany slug = błąd, nie fallback —
 * fallback na domyślny slug maskował literówki i mieszał dane tenantów.
 */
export function panelSlug(): string {
  const slug = process.env.CLIENT_SLUG
  if (!slug) throw new Error('Brak env CLIENT_SLUG — panel wymaga przypisanego tenanta')
  return slug
}

let cachedId: string | null = null

/** client_id tenanta panelu (cache na czas życia procesu — slug jest stały per deploy). */
export async function panelClientId(): Promise<string> {
  if (cachedId) return cachedId
  const c = await prisma.clients.findUnique({ where: { slug: panelSlug() }, select: { id: true } })
  if (!c) throw new Error(`Tenant '${panelSlug()}' nie istnieje w DB — sprawdź env CLIENT_SLUG`)
  cachedId = c.id
  return cachedId
}
