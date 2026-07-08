'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { embed, shortenForVoice, vectorLiteral } from '@/lib/ai-helpers'
import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { TARGET_LANGUAGES, translateFaq } from '@/lib/translator'
import { activeClientSlug } from '@/lib/tenant'

export type ActionResult = { ok: boolean; message?: string; errors?: Record<string, string> }

const ResolveSchema = z.object({
  note: z.string().max(1000).optional(),
})

const AcceptAsFaqSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(3).max(5000),
  category: z.string().min(1).max(50),
  scope: z.enum(['both', 'silver-place', 'silver-forest']).default('both'),
})

async function getResolverEmail(): Promise<string> {
  const session = await auth()
  return session?.user?.email ?? 'unknown'
}

// ---- Resolve / reopen ----

export async function resolveEscalation(
  id: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = ResolveSchema.safeParse({ note: (fd.get('note') as string)?.trim() })
  if (!parsed.success) return { ok: false, message: 'Błąd walidacji' }

  await prisma.escalations.update({
    where: { id },
    data: {
      resolved_at: new Date(),
      resolved_by: await getResolverEmail(),
      resolution_note: parsed.data.note || null,
    },
  })
  revalidatePath('/escalations')
  return { ok: true, message: 'Eskalacja rozwiązana' }
}

export async function reopenEscalation(id: string): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  await prisma.escalations.update({
    where: { id },
    data: { resolved_at: null, resolved_by: null, resolution_note: null },
  })
  revalidatePath('/escalations')
  return { ok: true, message: 'Otwarto ponownie' }
}

// ---- Accept jako nowy FAQ (auto-learning) ----

export async function acceptEscalationAsFaq(
  escalationId: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = AcceptAsFaqSchema.safeParse({
    question: (fd.get('question') as string)?.trim() ?? '',
    answer: (fd.get('answer') as string)?.trim() ?? '',
    category: (fd.get('category') as string)?.trim() ?? '',
    scope: (fd.get('scope') as string) || 'both',
  })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }

  // Znajdź conversation żeby wziąć client_id
  const esc = await prisma.escalations.findUnique({
    where: { id: escalationId },
    select: { client_id: true, resolved_at: true },
  })
  if (!esc) return { ok: false, message: 'Eskalacja nie istnieje' }

  // 1. Utwórz master FAQ PL
  const data = parsed.data
  let masterId: string
  try {
    const created = await prisma.faq.create({
      data: {
        client_id: esc.client_id,
        scope: data.scope,
        category: data.category,
        question: data.question,
        answer: data.answer,
        language: 'pl',
        is_active: true,
      },
      select: { id: true },
    })
    masterId = created.id
  } catch (e: any) {
    return { ok: false, message: `Insert FAQ failed: ${e?.message}` }
  }

  // 2. Embedding + answer_voice mastera
  try {
    const [vec, voice] = await Promise.all([
      embed(`${data.question}\n${data.answer}`),
      shortenForVoice(data.question, data.answer),
    ])
    await prisma.$executeRawUnsafe(
      'UPDATE faq SET embedding = $1::vector, answer_voice = $2, updated_at = now() WHERE id = $3',
      vectorLiteral(vec),
      voice,
      masterId,
    )
  } catch (e: any) {
    console.error('Master AI fields failed', masterId, e?.message)
  }

  // 3. Wygeneruj tłumaczenia (EN/UA/DE) — fire-and-forget, bo długie (~6s)
  try {
    const refreshed = await prisma.faq.findUnique({
      where: { id: masterId }, select: { answer_voice: true },
    })
    for (const lang of TARGET_LANGUAGES) {
      try {
        const tr = await translateFaq(data.question, data.answer, refreshed?.answer_voice ?? null, lang)
        const trEmb = await embed(`${tr.question}\n${tr.answer}`)
        const trRow = await prisma.faq.create({
          data: {
            client_id: esc.client_id,
            parent_id: masterId,
            scope: data.scope,
            category: data.category,
            language: lang,
            question: tr.question,
            answer: tr.answer,
            answer_voice: tr.answerVoice,
            manually_edited: false,
            auto_translated_at: new Date(),
            is_active: true,
          },
          select: { id: true },
        })
        await prisma.$executeRawUnsafe(
          'UPDATE faq SET embedding = $1::vector WHERE id = $2',
          vectorLiteral(trEmb),
          trRow.id,
        )
      } catch (e: any) {
        console.error(`Translation ${lang} failed:`, e?.message)
      }
    }
  } catch (e: any) {
    console.error('Translations gen failed', e?.message)
  }

  // 4. Mark eskalacja jako rozwiązaną + powiąż z FAQ
  await prisma.escalations.update({
    where: { id: escalationId },
    data: {
      resolved_at: esc.resolved_at ?? new Date(),
      resolved_by: await getResolverEmail(),
      resolution_note: `Zaakceptowane jako nowe FAQ ${masterId}`,
      new_faq_suggested: true,
      new_faq_id: masterId,
    },
  })

  revalidatePath('/escalations')
  revalidatePath('/faq')
  return { ok: true, message: 'Nowe FAQ utworzone i powiązane z eskalacją' }
}

// ---- Bulk resolve (zbiorcze rozwiązanie przefiltrowanych) ----


export async function resolveAllUnresolved(reason: string): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const client = await prisma.clients.findUnique({
    where: { slug: (await activeClientSlug()) },
    select: { id: true },
  })
  if (!client) return { ok: false, message: 'Brak klienta' }

  const res = await prisma.escalations.updateMany({
    where: {
      client_id: client.id,
      resolved_at: null,
      ...(reason && reason !== 'all' ? { reason } : {}),
    },
    data: {
      resolved_at: new Date(),
      resolved_by: await getResolverEmail(),
      resolution_note: 'Rozwiązane zbiorczo z panelu',
    },
  })
  revalidatePath('/escalations')
  return { ok: true, message: `Rozwiązano ${res.count} eskalacji` }
}
