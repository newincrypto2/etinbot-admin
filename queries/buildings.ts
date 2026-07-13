import { prisma } from '@/lib/prisma'
import { activeClientId } from '@/lib/tenant'
import { buildingLabel, type BuildingOption } from '@/lib/building-format'

/**
 * Budynki AKTYWNEGO tenanta — distinct apartments.building_code z DB.
 * Jedyne źródło opcji "Budynek/scope" w UI (FAQ, eskalacje, odbiorcy SMS,
 * apartamenty, integracje). Zero hardkodowanych nazw — nowy tenant rental
 * dostaje własne budynki z chwilą dodania apartamentów.
 */
export async function getBuildings(clientId?: string): Promise<BuildingOption[]> {
  const cid = clientId ?? (await activeClientId())
  if (!cid) return []
  const rows = await prisma.apartments.findMany({
    where: { client_id: cid },
    select: { building_code: true },
    distinct: ['building_code'],
    orderBy: { building_code: 'asc' },
  })
  return rows
    .filter((r) => r.building_code)
    .map((r) => ({ code: r.building_code, label: buildingLabel(r.building_code) }))
}

/**
 * Walidacja scope zapisywanego do DB: dozwolone `extra` (np. 'both'/'all')
 * albo istniejący kod budynku tenanta. Chroni przed zapisem śmieci z formularza
 * przy zachowaniu elastyczności (bez enumów silver-place/silver-forest).
 */
export async function isValidScope(
  scope: string,
  extra: string[] = ['both'],
  clientId?: string,
): Promise<boolean> {
  if (extra.includes(scope)) return true
  const buildings = await getBuildings(clientId)
  return buildings.some((b) => b.code === scope)
}
