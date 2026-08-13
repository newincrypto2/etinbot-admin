import { NextRequest, NextResponse } from 'next/server'

import { assertPermissionOrFail } from '@/lib/permissions'
import { activeClientSlug } from '@/lib/tenant'

/**
 * Proxy budowy bazy wiedzy z dokumentów: browser → (auth EDITOR+) → backend (Bearer).
 * Sekret BOT_API_KEY zostaje po stronie serwera panelu.
 *
 * - POST (multipart) → /api/admin/kb-documents/upload?slug= (przekazanie plików 1:1)
 * - GET             → /api/admin/kb-documents?slug=          (lista dokumentów, polling)
 */

function backendEnv(): { base: string; key: string } | null {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return null
  return { base: base.replace(/\/$/, ''), key }
}

export async function GET() {
  const guard = await assertPermissionOrFail('faq.view')
  if (!guard.ok) return new NextResponse(guard.message, { status: 403 })

  const env = backendEnv()
  if (!env) return new NextResponse('Brak BOT_API_URL / BOT_API_KEY w env panelu.', { status: 500 })

  const slug = await activeClientSlug()
  try {
    const res = await fetch(`${env.base}/api/admin/kb-documents?slug=${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${env.key}` },
      cache: 'no-store',
    })
    const text = await res.text().catch(() => '')
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (e) {
    return new NextResponse(
      JSON.stringify({ error: `Błąd połączenia: ${e instanceof Error ? e.message : String(e)}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export async function POST(req: NextRequest) {
  const guard = await assertPermissionOrFail('faq.manage')
  if (!guard.ok) return new NextResponse(guard.message, { status: 403 })

  const env = backendEnv()
  if (!env) return new NextResponse('Brak BOT_API_URL / BOT_API_KEY w env panelu.', { status: 500 })

  const slug = await activeClientSlug()

  // Przepisz przychodzące pliki do nowego FormData i przekaż do backendu.
  let inForm: FormData
  try {
    inForm = await req.formData()
  } catch (e) {
    return new NextResponse(`Nie udało się odczytać plików: ${e instanceof Error ? e.message : String(e)}`, { status: 400 })
  }
  const out = new FormData()
  let count = 0
  for (const [, value] of inForm.entries()) {
    if (value instanceof File) {
      out.append('files', value, value.name)
      count += 1
    }
  }
  if (count === 0) return new NextResponse('Brak plików w żądaniu.', { status: 400 })

  try {
    const res = await fetch(`${env.base}/api/admin/kb-documents/upload?slug=${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.key}` }, // Content-Type ustawi fetch (boundary)
      body: out,
      cache: 'no-store',
    })
    const text = await res.text().catch(() => '')
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (e) {
    return new NextResponse(
      `Nie udało się połączyć z backendem: ${e instanceof Error ? e.message : String(e)}`,
      { status: 502 },
    )
  }
}
