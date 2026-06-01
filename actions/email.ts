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

/** Upload załącznika do draftu (multipart → backend). */
export async function uploadAttachment(formData: FormData): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) return { ok: false, message: 'Brak BOT_API_URL / BOT_API_KEY.' }

  const draftId = formData.get('draft_id')
  const conversationId = String(formData.get('conversation_id') ?? '')
  const file = formData.get('file')
  if (!draftId || !(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Brak pliku lub draftu.' }
  }
  const fd = new FormData()
  fd.append('draft_id', String(draftId))
  fd.append('file', file)
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/email/attachment/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
      cache: 'no-store',
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, message: `Upload nie powiódł się (${res.status}). ${t.slice(0, 120)}` }
    }
  } catch (e) {
    return { ok: false, message: `Błąd uploadu: ${e instanceof Error ? e.message : String(e)}` }
  }
  revalidatePath(`/poczta/${conversationId}`)
  return { ok: true, message: 'Załącznik dodany.' }
}

/** Usuń załącznik wychodzący (przed wysłaniem). */
export async function removeAttachment(
  attachmentId: string,
  conversationId: string,
): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/email/attachment/remove', { attachment_id: attachmentId })
  if (!r.ok) return { ok: false, message: `Nie udało się usunąć (${r.status}).` }
  revalidatePath(`/poczta/${conversationId}`)
  return { ok: true, message: 'Załącznik usunięty.' }
}

/** Zatwierdź kandydata FAQ → dodaje do bazy wiedzy (z embeddingiem). */
export async function approveCandidate(
  candidateId: string,
  payload?: { question?: string; answer?: string; category?: string },
): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/email/faq-candidate/approve', {
    candidate_id: candidateId,
    question: payload?.question,
    answer: payload?.answer,
    category: payload?.category,
  })
  if (!r.ok) return { ok: false, message: `Nie udało się dodać do FAQ (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath('/faq-nauka')
  const action = (r.data.faq_action as string) ?? 'inserted'
  return { ok: true, message: action === 'updated' ? 'Zaktualizowano wpis FAQ ✅' : 'Dodano do FAQ ✅' }
}

/** Odrzuć kandydata FAQ. */
export async function rejectCandidate(candidateId: string): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/email/faq-candidate/reject', { candidate_id: candidateId })
  if (!r.ok) return { ok: false, message: `Nie udało się odrzucić (${r.status}).` }
  revalidatePath('/faq-nauka')
  return { ok: true, message: 'Kandydat odrzucony.' }
}
