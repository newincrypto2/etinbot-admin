import { prisma } from '@/lib/prisma'

export type ReservationStatusFilter = 'all' | 'upcoming' | 'current' | 'past'

export type ReservationRow = {
  reservationId: string
  guestName: string | null
  guestPhone: string | null
  guestEmail: string | null
  apartmentName: string | null
  checkIn: Date | null
  checkOut: Date | null
  nights: number | null
  status: string | null
  source: string | null
}

export type ListReservationsResult = {
  rows: ReservationRow[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 25

/** Dziś jako @db.Date (północ UTC) — check_in/check_out to kolumny typu Date (bez czasu). */
function todayDateUtc(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

export async function listReservations(opts: {
  clientSlug: string
  status?: string // 'all' | 'upcoming' | 'current' | 'past'
  q?: string
  page?: number
  pageSize?: number
}): Promise<ListReservationsResult> {
  const pageSize = opts.pageSize ?? PAGE_SIZE
  const page = Math.max(1, opts.page ?? 1)

  const c = await prisma.clients.findUnique({ where: { slug: opts.clientSlug }, select: { id: true } })
  if (!c) return { rows: [], total: 0, page, pageSize }
  const clientId = c.id

  const today = todayDateUtc()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { client_id: clientId }
  const status = opts.status ?? 'all'
  if (status === 'upcoming') where.check_in = { gt: today } // przyjazd w przyszłości
  else if (status === 'current') { where.check_in = { lte: today }; where.check_out = { gte: today } } // trwa
  else if (status === 'past') where.check_out = { lt: today } // wyjazd w przeszłości

  const q = (opts.q ?? '').trim()
  if (q) {
    where.OR = [
      { guest_name: { contains: q, mode: 'insensitive' as const } },
      { guest_phone: { contains: q.replace(/\s+/g, '') } },
      { reservation_id: { contains: q } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.reservations_cache.findMany({
      where,
      orderBy: { check_in: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: {
        reservation_id: true,
        guest_name: true,
        guest_phone: true,
        guest_email: true,
        check_in: true,
        check_out: true,
        nights: true,
        status: true,
        source: true,
        apartments: { select: { name: true } },
      },
    }),
    prisma.reservations_cache.count({ where }),
  ])

  return {
    rows: rows.map((r) => ({
      reservationId: r.reservation_id,
      guestName: r.guest_name,
      guestPhone: r.guest_phone,
      guestEmail: r.guest_email,
      apartmentName: r.apartments?.name ?? null,
      checkIn: r.check_in,
      checkOut: r.check_out,
      nights: r.nights,
      status: r.status,
      source: r.source,
    })),
    total,
    page,
    pageSize,
  }
}
