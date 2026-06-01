import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth-helpers'

/** Proxy pobierania załącznika przychodzącego: browser → (auth) → backend (Bearer). */
export async function GET(req: NextRequest) {
  await requireAuth()

  const inboundId = req.nextUrl.searchParams.get('inbound_id')
  const attId = req.nextUrl.searchParams.get('att_id')
  if (!inboundId || !attId) {
    return new NextResponse('Brak parametrów', { status: 400 })
  }
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return new NextResponse('Brak konfiguracji backendu', { status: 500 })

  const url = `${base.replace(/\/$/, '')}/api/email/attachment?inbound_id=${encodeURIComponent(
    inboundId,
  )}&att_id=${encodeURIComponent(attId)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' })
  if (!res.ok) {
    return new NextResponse('Nie udało się pobrać załącznika', { status: res.status })
  }
  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': res.headers.get('content-disposition') ?? 'attachment',
    },
  })
}
