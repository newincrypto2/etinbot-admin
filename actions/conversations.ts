'use server'

import { revalidatePath } from 'next/cache'
import { assertPermissionOrFail } from '@/lib/permissions'
import { auth } from '@/lib/auth'
import { callBackend } from '@/lib/backend'
import { prisma } from '@/lib/prisma'

export type ActionResult = { ok: boolean; message?: string }

/** Imię zalogowanego usera — podpis wiadomości pisanych z panelu (takeover). */
async function agentName(): Promise<string> {
  const session = await auth()
  return session?.user?.name || session?.user?.email || 'Obsługa'
}

// --- Human takeover ("Przejmij rozmowę") ---
// Backend gate'uje bota po conversations.taken_over_by (dispatch.respond_to_text);
// odpowiedzi człowieka dostarcza widget webchat przez GET /api/webchat/poll.

export async function takeoverConversation(id: string): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('conversations.manage')
  if (!guard.ok) return guard
  const res = await callBackend(`/api/admin/conversation/${id}/takeover`, { agent: await agentName() })
  if (!res.ok) return { ok: false, message: res.text || 'Błąd backendu przy przejęciu rozmowy.' }
  revalidatePath(`/conversations/${id}`)
  return { ok: true, message: 'Rozmowa przejęta — bot nie będzie odpisywał.' }
}

export async function releaseConversation(id: string): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('conversations.manage')
  if (!guard.ok) return guard
  const res = await callBackend(`/api/admin/conversation/${id}/release`, {})
  if (!res.ok) return { ok: false, message: res.text || 'Błąd backendu przy oddawaniu rozmowy.' }
  revalidatePath(`/conversations/${id}`)
  return { ok: true, message: 'Rozmowa oddana botowi.' }
}

export async function replyInConversation(id: string, text: string): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('conversations.manage')
  if (!guard.ok) return guard
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, message: 'Pusta wiadomość.' }
  const res = await callBackend(`/api/admin/conversation/${id}/reply`, {
    agent: await agentName(),
    text: trimmed,
  })
  if (!res.ok) return { ok: false, message: res.text || 'Nie udało się wysłać odpowiedzi.' }
  revalidatePath(`/conversations/${id}`)
  return { ok: true, message: 'Wysłano.' }
}

export async function closeConversation(id: string): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('conversations.manage')
  if (!guard.ok) return guard
  await prisma.conversations.update({
    where: { id },
    data: { status: 'closed', closed_at: new Date() },
  })
  revalidatePath('/conversations')
  revalidatePath(`/conversations/${id}`)
  return { ok: true, message: 'Zamknięto' }
}

export async function reopenConversation(id: string): Promise<ActionResult> {
  const guard = await assertPermissionOrFail('conversations.manage')
  if (!guard.ok) return guard
  await prisma.conversations.update({
    where: { id },
    data: { status: 'open', closed_at: null },
  })
  revalidatePath('/conversations')
  revalidatePath(`/conversations/${id}`)
  return { ok: true, message: 'Otwarto ponownie' }
}
