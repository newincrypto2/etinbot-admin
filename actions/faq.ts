'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { embed, shortenForVoice, vectorLiteral } from '@/lib/ai-helpers'
import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { TARGET_LANGUAGES, translateFaq, type TargetLang } from '@/lib/translator'

// ---- Schema walidacji ----

const SCOPES = ['both', 'silver-place', 'silver-forest'] as const

const FaqInputSchema = z.object({
  question: z.string().min(3, 'Pytanie min. 3 znaki').max(500),
  answer: z.string().min(3, 'Odpowiedź min. 3 znaki').max(5000),
  category: z.string().min(1, 'Kategoria wymagana').max(50),
  scope: z.enum(SCOPES).default('both'),
  isActive: z.boolean().default(true),
})

export type FaqInput = z.infer<typeof FaqInputSchema>

export type ActionResult<T = void> = {
  ok: boolean
  message?: string
  errors?: Record<string, string>
  data?: T
}

// ---- Helpers ----

async function getClientId(slug: string): Promise<string> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { id: true } })
  if (!c) throw new Error(`Client ${slug} not found`)
  return c.id
}

/** Generuj+wsadź embedding + answer_voice dla mastera PL. */
async function regenerateMasterAiFields(faqId: string, question: string, answer: string) {
  const [vec, voice] = await Promise.all([
    embed(`${question}\n${answer}`),
    shortenForVoice(question, answer),
  ])
  await prisma.$executeRawUnsafe(
    'UPDATE faq SET embedding = $1::vector, answer_voice = $2, updated_at = now() WHERE id = $3',
    vectorLiteral(vec),
    voice,
    faqId,
  )
}

/** Wygeneruj tłumaczenia na 3 języki i upsert do DB jako dzieci mastera. */
async function generateTranslations(masterId: string, question: string, answer: string, answerVoice: string | null) {
  const master = await prisma.faq.findUnique({
    where: { id: masterId },
    select: { client_id: true, scope: true, category: true, source_doc: true, source_question_num: true },
  })
  if (!master) return

  for (const lang of TARGET_LANGUAGES) {
    try {
      const tr = await translateFaq(question, answer, answerVoice, lang)
      const vec = await embed(`${tr.question}\n${tr.answer}`)

      // Upsert: jeśli istnieje tłumaczenie z tym samym parent_id+lang AND manually_edited=false, nadpisz
      // Jeśli manually_edited=true, SKIP (zostaw oryginalne).
      const existing = await prisma.faq.findFirst({
        where: { parent_id: masterId, language: lang },
        select: { id: true, manually_edited: true },
      })

      if (existing) {
        if (existing.manually_edited) continue  // skip — admin ręcznie edytował
        // Update
        await prisma.faq.update({
          where: { id: existing.id },
          data: {
            question: tr.question,
            answer: tr.answer,
            answer_voice: tr.answerVoice,
            auto_translated_at: new Date(),
          },
        })
        await prisma.$executeRawUnsafe(
          'UPDATE faq SET embedding = $1::vector WHERE id = $2',
          vectorLiteral(vec),
          existing.id,
        )
      } else {
        // Insert new
        const created = await prisma.faq.create({
          data: {
            client_id: master.client_id,
            parent_id: masterId,
            scope: master.scope,
            category: master.category,
            language: lang,
            question: tr.question,
            answer: tr.answer,
            answer_voice: tr.answerVoice,
            source_doc: master.source_doc,
            source_question_num: master.source_question_num,
            manually_edited: false,
            auto_translated_at: new Date(),
            is_active: true,
          },
          select: { id: true },
        })
        await prisma.$executeRawUnsafe(
          'UPDATE faq SET embedding = $1::vector WHERE id = $2',
          vectorLiteral(vec),
          created.id,
        )
      }
    } catch (e: any) {
      console.error(`Translation ${lang} failed for master ${masterId}:`, e?.message)
    }
  }
}

function parseFormData(fd: FormData): Partial<FaqInput> {
  const get = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  return {
    question: get('question'),
    answer: get('answer'),
    category: get('category'),
    scope: (get('scope') as any) || 'both',
    isActive: fd.get('isActive') === 'on' || fd.get('isActive') === 'true',
  }
}

// ---- Server actions: master PL ----

export async function createFaq(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = FaqInputSchema.safeParse(parseFormData(fd))
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }
  const data = parsed.data
  const clientSlug = process.env.CLIENT_SLUG ?? 'matysproperty'
  const clientId = await getClientId(clientSlug)

  let createdId: string
  try {
    const created = await prisma.faq.create({
      data: {
        client_id: clientId,
        scope: data.scope,
        category: data.category,
        question: data.question,
        answer: data.answer,
        language: 'pl',
        is_active: data.isActive,
        // parent_id = NULL (master)
      },
      select: { id: true },
    })
    createdId = created.id
  } catch (e: any) {
    return { ok: false, message: `Insert failed: ${e?.message ?? e}` }
  }

  try {
    await regenerateMasterAiFields(createdId, data.question, data.answer)
  } catch (e: any) {
    console.error('Master AI regen failed', createdId, e?.message)
  }

  // Generate translations (long-running, ale OK — admin może poczekać)
  try {
    const refreshed = await prisma.faq.findUnique({
      where: { id: createdId }, select: { answer_voice: true },
    })
    await generateTranslations(createdId, data.question, data.answer, refreshed?.answer_voice ?? null)
  } catch (e: any) {
    console.error('Translations gen failed', createdId, e?.message)
  }

  revalidatePath('/faq')
  redirect('/faq')
}

export async function updateFaq(id: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = FaqInputSchema.safeParse(parseFormData(fd))
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }
  const data = parsed.data

  const existing = await prisma.faq.findUnique({
    where: { id },
    select: { question: true, answer: true, parent_id: true },
  })
  if (!existing) return { ok: false, message: 'FAQ nie istnieje' }
  if (existing.parent_id) {
    return { ok: false, message: 'To jest tłumaczenie, użyj updateTranslation' }
  }
  const aiChanged = existing.question !== data.question || existing.answer !== data.answer

  try {
    await prisma.faq.update({
      where: { id },
      data: {
        scope: data.scope,
        category: data.category,
        question: data.question,
        answer: data.answer,
        is_active: data.isActive,
      },
    })
  } catch (e: any) {
    return { ok: false, message: `Update failed: ${e?.message ?? e}` }
  }

  if (aiChanged) {
    try {
      await regenerateMasterAiFields(id, data.question, data.answer)
      const refreshed = await prisma.faq.findUnique({
        where: { id }, select: { answer_voice: true },
      })
      // Re-translate dla dzieci gdzie manually_edited=false
      await generateTranslations(id, data.question, data.answer, refreshed?.answer_voice ?? null)
    } catch (e: any) {
      console.error('AI regen failed', id, e?.message)
    }
  }

  revalidatePath('/faq')
  revalidatePath(`/faq/${id}/edit`)
  redirect('/faq')
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  try {
    // CASCADE usuwa dzieci (tłumaczenia) automatycznie
    await prisma.faq.delete({ where: { id } })
  } catch (e: any) {
    return { ok: false, message: `Delete failed: ${e?.message ?? e}` }
  }
  revalidatePath('/faq')
  return { ok: true, message: 'Usunięto' }
}

export async function toggleFaqActive(id: string): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const row = await prisma.faq.findUnique({
    where: { id },
    select: { is_active: true },
  })
  if (!row) return { ok: false, message: 'Nie istnieje' }

  await prisma.faq.update({
    where: { id },
    data: { is_active: !row.is_active },
  })
  revalidatePath('/faq')
  return { ok: true, message: row.is_active ? 'Wyłączono' : 'Włączono' }
}

// ---- Server actions: tłumaczenia ----

const TranslationInputSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(3).max(5000),
  answerVoice: z.string().max(500).optional(),
})

export async function updateTranslation(
  id: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const parsed = TranslationInputSchema.safeParse({
    question: (fd.get('question') as string)?.trim() ?? '',
    answer: (fd.get('answer') as string)?.trim() ?? '',
    answerVoice: ((fd.get('answerVoice') as string) ?? '').trim(),
  })
  if (!parsed.success) {
    return { ok: false, message: 'Błędy walidacji' }
  }
  const d = parsed.data

  const tr = await prisma.faq.findUnique({
    where: { id },
    select: { parent_id: true, language: true },
  })
  if (!tr || !tr.parent_id) {
    return { ok: false, message: 'To nie jest tłumaczenie' }
  }

  await prisma.faq.update({
    where: { id },
    data: {
      question: d.question,
      answer: d.answer,
      answer_voice: d.answerVoice || null,
      manually_edited: true,  // od teraz nie nadpisuj przy re-translate mastera
    },
  })

  // Re-embed bo Q/A się zmieniły
  try {
    const vec = await embed(`${d.question}\n${d.answer}`)
    await prisma.$executeRawUnsafe(
      'UPDATE faq SET embedding = $1::vector, updated_at = now() WHERE id = $2',
      vectorLiteral(vec),
      id,
    )
  } catch (e: any) {
    console.error('Translation re-embed failed', id, e?.message)
  }

  revalidatePath(`/faq/${tr.parent_id}/edit`)
  return { ok: true, message: 'Tłumaczenie zaktualizowane (oznaczone jako ręcznie edytowane)' }
}

export async function regenerateTranslation(
  parentId: string,
  language: TargetLang,
): Promise<ActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }

  const master = await prisma.faq.findUnique({
    where: { id: parentId },
    select: { question: true, answer: true, answer_voice: true, parent_id: true },
  })
  if (!master) return { ok: false, message: 'Master nie istnieje' }
  if (master.parent_id) return { ok: false, message: 'To jest tłumaczenie, nie master' }

  try {
    // Force re-translate — reset manually_edited
    await prisma.faq.updateMany({
      where: { parent_id: parentId, language },
      data: { manually_edited: false },
    })
    await generateTranslations(parentId, master.question, master.answer, master.answer_voice)
  } catch (e: any) {
    return { ok: false, message: `Re-translate failed: ${e?.message}` }
  }

  revalidatePath(`/faq/${parentId}/edit`)
  return { ok: true, message: `Tłumaczenie ${language.toUpperCase()} przegenerowane` }
}
