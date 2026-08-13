import { NextRequest, NextResponse } from 'next/server'

import { assertPermissionOrFail } from '@/lib/permissions'

/**
 * Proxy eksportu danych tenanta: browser → (auth SUPERADMIN) → backend (Bearer).
 * Przeglądarka nie zna BOT_API_KEY — sekret zostaje po stronie serwera panelu.
 * GET, bo przycisk „Eksportuj" to zwykły link pobierania (Content-Disposition).
 */
export async function GET(req: NextRequest) {
  const guard = await assertPermissionOrFail('clients.manage')
  if (!guard.ok) return new NextResponse(guard.message, { status: 403 })

  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return new NextResponse('Brak parametru slug', { status: 400 })

  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return new NextResponse('Brak BOT_API_URL / BOT_API_KEY w env panelu.', { status: 500 })

  let res: Response
  try {
    res = await fetch(`${base.replace(/\/$/, '')}/api/admin/export-tenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ slug }),
      cache: 'no-store',
    })
  } catch (e) {
    return new NextResponse(
      `Nie udało się połączyć z backendem: ${e instanceof Error ? e.message : String(e)}`,
      { status: 502 },
    )
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    return new NextResponse(`Backend zwrócił ${res.status}. ${t.slice(0, 200)}`, { status: res.status })
  }

  const buf = await res.arrayBuffer()
  const fallback = `etinbot-export-${slug}.json`
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': res.headers.get('content-disposition') ?? `attachment; filename="${fallback}"`,
    },
  })
}
