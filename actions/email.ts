'use server'

import { revalidatePath } from 'next/cache'

import { assertRoleOrFail } from '@/lib/auth-helpers'

export type EmailActionResult = { ok: boolean; message: string; draftId?: string }

async function callBackend(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; text: string }> {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) {
    return { ok: false, status: 0, data: {}, text: 'Brak BOT_API_URL / BOT_API_KEY w env panelu.' }
  }
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text().catch(() => '')
  let data: Record<string, unknown> = {}
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, data, text }
}

/** Wyślij zatwierdzony draft (opcjonalnie z edytowaną treścią). */
export async function sendDraft(
  draftId: string,
  conversationId: string,
  bodyText?: string,
): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const r = await callBackend('/api/email/send', { draft_id: draftId, body_text: bodyText })
  if (!r.ok) {
    return { ok: false, message: `Wysyłka nie powiodła się (${r.status}). ${r.text.slice(0, 160)}` }
  }
  revalidatePath(`/poczta/${conversationId}`)
  revalidatePath('/poczta')
  const status = (r.data.status as string) ?? 'sent'
  return {
    ok: true,
    message: status === 'already_sent' ? 'Ten draft był już wysłany.' : 'Wysłano odpowiedź ✅',
  }
}

/** Quick-reply: konsultant pisze rdzeń, bot opakowuje w pełny brandowany draft. */
export async function wrapQuickReply(
  conversationId: string,
  coreText: string,
): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  if (!coreText.trim()) return { ok: false, message: 'Wpisz rdzeń odpowiedzi.' }

  const r = await callBackend('/api/email/wrap', {
    conversation_id: conversationId,
    core_text: coreText,
  })
  if (!r.ok) {
    return { ok: false, message: `Nie udało się wygenerować draftu (${r.status}). ${r.text.slice(0, 160)}` }
  }
  revalidatePath(`/poczta/${conversationId}`)
  return { ok: true, message: 'Bot opakował odpowiedź — sprawdź draft i wyślij.', draftId: r.data.draft_id as string }
}

/** Odrzuć draft. */
export async function discardDraft(
  draftId: string,
  conversationId: string,
): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const r = await callBackend('/api/email/discard', { draft_id: draftId })
  if (!r.ok) return { ok: false, message: `Nie udało się odrzucić (${r.status}).` }
  revalidatePath(`/poczta/${conversationId}`)
  return { ok: true, message: 'Draft odrzucony.' }
}
