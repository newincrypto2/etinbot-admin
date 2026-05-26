import { prisma } from '@/lib/prisma'

export type ApartmentRow = {
  id: string
  clientId: string
  idobookingId: string | null
  buildingCode: string
  name: string
  address: string | null
  floor: number | null
  entranceCode: string | null
  accessMethod: string | null
  smartlockProvider: string | null
  staticAccessCode: string | null
  wifiSsid: string | null
  wifiPassword: string | null
  parkingAvailable: boolean | null
  parkingPricePerDay: string | null
  parkingInfo: string | null
  maxGuests: number | null
  notes: string | null
  updatedAt: Date
}

const SELECT = {
  id: true,
  client_id: true,
  idobooking_id: true,
  building_code: true,
  name: true,
  address: true,
  floor: true,
  entrance_code: true,
  access_method: true,
  smartlock_provider: true,
  static_access_code: true,
  wifi_ssid: true,
  wifi_password: true,
  parking_available: true,
  parking_price_per_day: true,
  parking_info: true,
  max_guests: true,
  notes: true,
  updated_at: true,
}

function toRow(r: any): ApartmentRow {
  return {
    id: r.id,
    clientId: r.client_id,
    idobookingId: r.idobooking_id,
    buildingCode: r.building_code,
    name: r.name,
    address: r.address,
    floor: r.floor,
    entranceCode: r.entrance_code,
    accessMethod: r.access_method,
    smartlockProvider: r.smartlock_provider,
    staticAccessCode: r.static_access_code,
    wifiSsid: r.wifi_ssid,
    wifiPassword: r.wifi_password,
    parkingAvailable: r.parking_available,
    parkingPricePerDay: r.parking_price_per_day?.toString() ?? null,
    parkingInfo: r.parking_info,
    maxGuests: r.max_guests,
    notes: r.notes,
    updatedAt: r.updated_at,
  }
}

export async function listApartments(opts: {
  clientSlug?: string
  building?: string
  search?: string
}): Promise<ApartmentRow[]> {
  const where: any = {}
  if (opts.clientSlug) where.clients = { slug: opts.clientSlug }
  if (opts.building && opts.building !== 'all') where.building_code = opts.building
  if (opts.search) {
    where.OR = [
      { name: { contains: opts.search, mode: 'insensitive' } },
      { address: { contains: opts.search, mode: 'insensitive' } },
    ]
  }
  const rows = await prisma.apartments.findMany({
    where,
    orderBy: [{ building_code: 'asc' }, { floor: 'asc' }, { name: 'asc' }],
    select: SELECT,
  })
  return rows.map(toRow)
}

export async function getApartmentById(id: string): Promise<ApartmentRow | null> {
  const r = await prisma.apartments.findUnique({ where: { id }, select: SELECT })
  return r ? toRow(r) : null
}

export async function listBuildings(clientSlug: string): Promise<{ code: string; count: number }[]> {
  const rows = await prisma.apartments.groupBy({
    by: ['building_code'],
    where: { clients: { slug: clientSlug } },
    _count: true,
  })
  return rows.map((r) => ({ code: r.building_code, count: r._count }))
}
