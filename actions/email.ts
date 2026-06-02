'use server'

import { revalidatePath } from 'next/cache'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export type EmailActionResult = { ok: boolean; message: string; draftId?: string; redirect?: boolean }

const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'wp.pl', 'onet.pl', 'poczta.onet.pl', 'o2.pl', 'go2.pl',
  'interia.pl', 'interia.eu', 'gazeta.pl', 'op.pl', 'poczta.fm', 'vp.pl', 'tlen.pl',
  'yahoo.com', 'yahoo.pl', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'aol.com',
])

function coerceObj(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

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

async function addTag(id: string, tag: string): Promise<string[]> {
  const conv = await prisma.conversations.findUnique({ where: { id }, select: { tags: true } })
  return Array.from(new Set([...(conv?.tags ?? []), tag]))
}

/** Zamknij / otwórz ponownie wątek mailowy. */
export async function setEmailThreadClosed(id: string, closed: boolean): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  await prisma.conversations.update({
    where: { id },
    data: closed ? { status: 'closed', closed_at: new Date() } : { status: 'open', closed_at: null },
  })
  revalidatePath(`/poczta/${id}`)
  revalidatePath('/poczta')
  return { ok: true, message: closed ? 'Wątek zamknięty.' : 'Wątek otwarty ponownie.' }
}

/** Oznacz wątek jako B2B / hurt (tag). */
export async function tagEmailThreadB2B(id: string): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  await prisma.conversations.update({ where: { id }, data: { tags: await addTag(id, 'b2b') } })
  revalidatePath(`/poczta/${id}`)
  revalidatePath('/poczta')
  return { ok: true, message: 'Oznaczono jako B2B / hurt.' }
}

/**
 * Oznacz wątek jako spam — działa jak filtr i ROZSZERZA go:
 * 1. dodaje nadawcę do filtra tenanta (freemail → adres, firmowa domena → domena),
 * 2. konwertuje wiadomości wątku w rekord odfiltrowany (pokazuje się w „Spam / filtr"),
 * 3. usuwa wątek ze skrzynki. Przyszłe maile od nadawcy lecą automatycznie w spam.
 */
export async function markEmailThreadSpam(id: string): Promise<EmailActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const conv = await prisma.conversations.findUnique({ where: { id }, select: { client_id: true } })
  if (!conv) return { ok: false, message: 'Wątek nie istnieje.' }

  // Realny NADAWCA z wiadomości przychodzącej (przy compose guest_email = odbiorca!)
  const inbound = await prisma.email_inbound.findFirst({
    where: { conversation_id: id },
    orderBy: { received_at: 'desc' },
    select: { from_address: true },
  })
  const sender = (inbound?.from_address ?? '').toLowerCase().trim()

  let learned = ''
  if (sender.includes('@')) {
    const domain = sender.split('@')[1]
    const client = await prisma.clients.findUnique({ where: { id: conv.client_id }, select: { config: true } })
    const cfg = coerceObj(client?.config)
    const integ = coerceObj(cfg.integrations)
    const es = coerceObj(integ.email_spam)
    if (FREEMAIL.has(domain)) {
      const arr = Array.isArray(es.addresses) ? (es.addresses as string[]) : []
      es.addresses = Array.from(new Set([...arr, sender]))
      learned = sender
    } else {
      const arr = Array.isArray(es.domains) ? (es.domains as string[]) : []
      es.domains = Array.from(new Set([...arr, domain]))
      learned = domain
    }
    integ.email_spam = es
    cfg.integrations = integ
    await prisma.clients.update({ where: { id: conv.client_id }, data: { config: cfg as object } })
  }

  // Konwersja inbound → rekord odfiltrowany (widoczny w „Spam / filtr") + odpięcie od wątku
  await prisma.email_inbound.updateMany({
    where: { conversation_id: id },
    data: { status: 'skipped_spam', is_spam: true, skip_reason: 'oznaczone ręcznie', conversation_id: null },
  })
  // Usuń wątek (cascade: messages, drafts; email_inbound już odpięte → zostaje)
  await prisma.conversations.delete({ where: { id } })

  revalidatePath('/poczta')
  return {
    ok: true,
    message: learned ? `Spam — dodano do filtra (${learned}).` : 'Oznaczono jako spam.',
    redirect: true,
  }
}

/** Rozpocznij nową konwersację mailową (compose) → tworzy draft do wysłania. */
export async function composeEmail(input: {
  mailboxAddress: string
  toAddress: string
  subject: string
  bodyText: string
}): Promise<EmailActionResult & { conversationId?: string }> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const slug = process.env.CLIENT_SLUG ?? 'krainaherbaty'
  const r = await callBackend('/api/email/compose', {
    slug,
    mailbox_address: input.mailboxAddress,
    to_address: input.toAddress,
    subject: input.subject,
    body_text: input.bodyText,
  })
  if (!r.ok) return { ok: false, message: `Nie udało się utworzyć (${r.status}). ${r.text.slice(0, 140)}` }
  revalidatePath('/poczta')
  return {
    ok: true,
    message: 'Utworzono — dodaj załączniki i wyślij.',
    conversationId: r.data.conversation_id as string,
  }
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
