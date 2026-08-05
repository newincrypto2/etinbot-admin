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
  revalidatePath('/konto')
  return { ok: true, message: html === '' ? 'Stopka wyczyszczona.' : 'Zapisano stopkę ✅' }
}

/**
 * Upload obrazka (logo) do stopki — backend hostuje plik publicznie i zwraca
 * URL do wstawienia w <img src>. Multipart przekazywany 1:1 do backendu.
 */
export async function uploadSignatureImage(
  fd: FormData,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return { ok: false, message: 'Brak sesji — zaloguj się ponownie.' }

  const file = fd.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Brak pliku.' }
  }

  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return { ok: false, message: 'Brak BOT_API_URL / BOT_API_KEY w env panelu.' }

  const out = new FormData()
  out.append('file', file)
  out.append('uploaded_by', email)
  const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/signature-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: out,
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let detail = text.slice(0, 160)
    try { detail = JSON.parse(text).detail ?? detail } catch { /* surowy tekst */ }
    return { ok: false, message: `Upload nie powiódł się (${res.status}). ${detail}` }
  }
  const data = (await res.json()) as { url?: string }
  if (!data.url) return { ok: false, message: 'Backend nie zwrócił URL obrazka.' }
  return { ok: true, url: data.url }
}
