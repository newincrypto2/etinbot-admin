'use server'

import { revalidatePath } from 'next/cache'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type ActionResult = {
  ok: boolean
  message?: string
}

/** Helper — wołanie backendu EtinBOT (wzorzec z actions/email.ts). */
async function callBackend(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string }> {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) {
    return { ok: false, status: 0, text: 'Brak BOT_API_URL / BOT_API_KEY w env panelu.' }
  }
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, text }
}

/**
 * Zapis własnej stopki maila. KAŻDY zalogowany użytkownik edytuje WYŁĄCZNIE
 * własną stopkę — email bierzemy z sesji, nie z formularza (nie da się podmienić).
 * Sanityzacja HTML dzieje się po stronie backendu.
 */
export async function saveMySignature(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return { ok: false, message: 'Brak sesji — zaloguj się ponownie.' }

  const raw = fd.get('signatureHtml')
  const html = typeof raw === 'string' ? raw.trim() : ''

  const r = await callBackend('/api/admin/user-signature', {
    email,
    signature_html: html === '' ? null : html,
  })
  if (!r.ok) {
    return { ok: false, message: `Zapis nie powiódł się (${r.status}). ${r.text.slice(0, 160)}` }
  }

  // Odśwież prefill (własny rekord AdminUser czytany z Prisma na stronie).
  revalidatePath('/settings/signature')
  return { ok: true, message: html === '' ? 'Stopka wyczyszczona.' : 'Zapisano stopkę ✅' }
}
