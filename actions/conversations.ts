'use server'

import { revalidatePath } from 'next/cache'
import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export type ActionResult = { ok: boolean; message?: string }

export async function closeConversation(id: string): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
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
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return guard
  await prisma.conversations.update({
    where: { id },
    data: { status: 'open', closed_at: null },
  })
  revalidatePath('/conversations')
  revalidatePath(`/conversations/${id}`)
  return { ok: true, message: 'Otwarto ponownie' }
}
