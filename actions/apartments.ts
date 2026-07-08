'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { activeClientSlug } from '@/lib/tenant'

const BUILDINGS = ['silver-place', 'silver-forest'] as const
const ACCESS_METHODS = ['smartlock', 'lockbox', 'reception', 'static_code'] as const
const SMARTLOCK_PROVIDERS = ['', 'ttlock', 'nuki', 'yale', 'igloohome', 'other'] as const

const ApartmentInputSchema = z.object({
  name: z.string().min(1, 'Nazwa wymagana').max(100),
  buildingCode: z.enum(BUILDINGS),
  address: z.string().max(200).optional().nullable(),
  floor: z.coerce.number().int().min(-2).max(20).optional().nullable(),
  entranceCode: z.string().max(50).optional().nullable(),

  accessMethod: z.enum(ACCESS_METHODS).optional().nullable(),
  smartlockProvider: z.enum(SMARTLOCK_PROVIDERS).optional().nullable(),
  staticAccessCode: z.string().max(50).optional().nullable(),

  wifiSsid: z.string().max(100).optional().nullable(),
  wifiPassword: z.string().max(100).optional().nullable(),

  parkingAvailable: z.boolean().default(false),
  parkingPricePerDay: z.coerce.number().min(0).optional().nullable(),
  parkingInfo: z.string().max(500).optional().nullable(),

  maxGuests: z.coerce.number().int().min(1).max(20).optional().nullable(),
  idobookingId: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export type ApartmentInput = z.infer<typeof ApartmentInputSchema>

export type ActionResult<T = void> = {
  ok: boolean
  message?: string
  errors?: Record<string, string>
  data?: T
}

async function getClientId(slug: string): Promise<string> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { id: true } })
  if (!c) throw new Error(`Client ${slug} not found`)
  return c.id
}

function parseFormData(fd: FormData): Partial<ApartmentInput> {
  const get = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  const empty = (s: string) => s === '' ? null : s
  return {
    name: get('name'),
    buildingCode: get('buildingCode') as any,
    address: empty(get('address')),
    floor: get('floor') ? Number(get('floor')) : null,
    entranceCode: empty(get('entranceCode')),
    accessMethod: empty(get('accessMethod')) as any,
    smartlockProvider: empty(get('smartlockProvider')) as any,
    staticAccessCode: empty(get('staticAccessCode')),
    wifiSsid: empty(get('wifiSsid')),
    wifiPassword: empty(get('wifiPassword')),
    parkingAvailable: fd.get('parkingAvailable') === 'on',
    parkingPricePerDay: get('parkingPricePerDay') ? Number(get('parkingPricePerDay')) : null,
    parkingInfo: empty(get('parkingInfo')),
    maxGuests: get('maxGuests') ? Number(get('maxGuests')) : null,
    idobookingId: empty(get('idobookingId')),
    notes: empty(get('notes')),
  }
}

function dataForDb(d: ApartmentInput) {
  return {
    name: d.name,
    building_code: d.buildingCode,
    address: d.address ?? null,
    floor: d.floor ?? null,
    entrance_code: d.entranceCode ?? null,
    access_method: d.accessMethod ?? null,
    smartlock_provider: d.smartlockProvider === '' ? null : (d.smartlockProvider ?? null),
    static_access_code: d.staticAccessCode ?? null,
    wifi_ssid: d.wifiSsid ?? null,
    wifi_password: d.wifiPassword ?? null,
    parking_available: d.parkingAvailable,
    parking_price_per_day: d.parkingPricePerDay ?? null,
    parking_info: d.parkingInfo ?? null,
    max_guests: d.maxGuests ?? null,
    idobooking_id: d.idobookingId ?? null,
    notes: d.notes ?? null,
  }
}

export async function createApartment(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = ApartmentInputSchema.safeParse(parseFormData(fd))
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }

  const clientSlug = await activeClientSlug()
  const clientId = await getClientId(clientSlug)

  try {
    await prisma.apartments.create({
      data: { client_id: clientId, ...dataForDb(parsed.data) },
    })
  } catch (e: any) {
    return { ok: false, message: `Insert failed: ${e?.message ?? e}` }
  }

  revalidatePath('/apartments')
  redirect('/apartments')
}

export async function updateApartment(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = ApartmentInputSchema.safeParse(parseFormData(fd))
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }

  try {
    await prisma.apartments.update({
      where: { id },
      data: dataForDb(parsed.data),
    })
  } catch (e: any) {
    return { ok: false, message: `Update failed: ${e?.message ?? e}` }
  }

  revalidatePath('/apartments')
  redirect('/apartments')
}

export async function deleteApartment(id: string): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  try {
    await prisma.apartments.delete({ where: { id } })
  } catch (e: any) {
    return { ok: false, message: `Delete failed: ${e?.message ?? e}` }
  }
  revalidatePath('/apartments')
  return { ok: true, message: 'Usunięto' }
}

/**
 * Stub synchronizacji z IdoBooking.
 *
 * Faktyczna implementacja w `silverplace-bot/scripts/sync_apartments_from_ido.py`
 * — wywołuje IdoBooking `Objects.getAll`, mapuje na nasz schema, upsert do `apartments`.
 *
 * Tutaj tylko logika UI: triggerujemy backend cron (TODO: HTTP call do bota).
 * Na razie zwracamy informację o stanie.
 */
export async function syncFromIdoBooking(): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  // TODO Sprint 2: HTTP POST do bota /api/admin/sync-apartments
  // z autoryzacją przez BOT_API_KEY.
  return {
    ok: false,
    message: 'Sync z IdoBooking nieaktywny — czeka na klucz API od brata. Setup w silverplace-bot/.env (IDOBOOKING_TENANT, IDOBOOKING_LOGIN, IDOBOOKING_API_KEY).',
  }
}
