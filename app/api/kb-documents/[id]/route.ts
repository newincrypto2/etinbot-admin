import { NextRequest, NextResponse } from 'next/server'

import { assertRoleOrFail } from '@/lib/auth-helpers'

/**
 * Akcje na dokumencie KB: browser → (auth EDITOR+) → backend (Bearer).
 * POST /api/kb-documents/{id}?action=undo|retry
 * - undo  → usuwa wpisy FAQ powstałe z tego dokumentu
 * - retry → ponawia przetwarzanie (failed/undone → queued)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return new NextResponse(guard.message, { status: 403 })

  const { id } = await ctx.params
  const action = req.nextUrl.searchParams.get('action')
  if (action !== 'undo' && action !== 'retry') {
    return new NextResponse('Nieznana akcja (undo|retry).', { status: 400 })
  }

  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return new NextResponse('Brak BOT_API_URL / BOT_API_KEY w env panelu.', { status: 500 })

  try {
    const res = await fetch(
      `${base.replace(/\/$/, '')}/api/admin/kb-documents/${encodeURIComponent(id)}/${action}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
      },
    )
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
