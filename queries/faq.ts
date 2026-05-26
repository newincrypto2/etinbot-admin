import { prisma } from '@/lib/prisma'

export type FaqRow = {
  id: string
  clientId: string
  scope: string
  category: string
  question: string
  answer: string
  answerVoice: string | null
  language: string
  hitCount: bigint | null
  sourceQuestionNum: number | null
  isActive: boolean | null
  updatedAt: Date
}

export async function listFaq(opts: {
  clientSlug?: string
  scope?: string         // 'all' | 'both' | 'silver-place' | 'silver-forest'
  category?: string      // 'all' | concrete
  search?: string
}): Promise<FaqRow[]> {
  const where: any = {}

  if (opts.clientSlug) {
    where.clients = { slug: opts.clientSlug }
  }
  // TYLKO mastery PL — tłumaczenia ukryte przed listą
  where.parent_id = null
  where.language = 'pl'

  if (opts.scope && opts.scope !== 'all') {
    where.scope = opts.scope
  }
  if (opts.category && opts.category !== 'all') {
    where.category = opts.category
  }
  if (opts.search) {
    where.OR = [
      { question: { contains: opts.search, mode: 'insensitive' } },
      { answer: { contains: opts.search, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.faq.findMany({
    where,
    orderBy: [{ category: 'asc' }, { source_question_num: 'asc' }],
    select: {
      id: true,
      client_id: true,
      scope: true,
      category: true,
      question: true,
      answer: true,
      answer_voice: true,
      language: true,
      hit_count: true,
      source_question_num: true,
      is_active: true,
      updated_at: true,
    },
  })

  return rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    scope: r.scope,
    category: r.category,
    question: r.question,
    answer: r.answer,
    answerVoice: r.answer_voice,
    language: r.language,
    hitCount: r.hit_count,
    sourceQuestionNum: r.source_question_num,
    isActive: r.is_active,
    updatedAt: r.updated_at,
  }))
}

export async function getFaqStats(clientSlug: string) {
  // Liczymy tylko mastery — nie chcemy duplikować przez tłumaczenia
  const baseWhere = { clients: { slug: clientSlug }, parent_id: null, language: 'pl' }
  const total = await prisma.faq.count({ where: baseWhere })
  const active = await prisma.faq.count({ where: { ...baseWhere, is_active: true } })

  const byCategory = await prisma.faq.groupBy({
    by: ['category'],
    where: baseWhere,
    _count: true,
  })

  const byScope = await prisma.faq.groupBy({
    by: ['scope'],
    where: baseWhere,
    _count: true,
  })

  return {
    total,
    active,
    byCategory: byCategory.map((r) => ({ category: r.category, count: r._count })),
    byScope: byScope.map((r) => ({ scope: r.scope, count: r._count })),
  }
}

export async function getFaqById(id: string): Promise<FaqRow | null> {
  const r = await prisma.faq.findUnique({
    where: { id },
    select: {
      id: true,
      client_id: true,
      scope: true,
      category: true,
      question: true,
      answer: true,
      answer_voice: true,
      language: true,
      hit_count: true,
      source_question_num: true,
      is_active: true,
      updated_at: true,
    },
  })
  if (!r) return null
  return {
    id: r.id,
    clientId: r.client_id,
    scope: r.scope,
    category: r.category,
    question: r.question,
    answer: r.answer,
    answerVoice: r.answer_voice,
    language: r.language,
    hitCount: r.hit_count,
    sourceQuestionNum: r.source_question_num,
    isActive: r.is_active,
    updatedAt: r.updated_at,
  }
}

export async function listCategories(clientSlug: string): Promise<string[]> {
  const rows = await prisma.faq.findMany({
    where: { clients: { slug: clientSlug }, parent_id: null, language: 'pl' },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  return rows.map((r) => r.category)
}

export type TranslationRow = {
  id: string
  parentId: string
  language: string
  question: string
  answer: string
  answerVoice: string | null
  manuallyEdited: boolean
  autoTranslatedAt: Date | null
  updatedAt: Date
}

/** Pobierz tłumaczenia mastera (EN/UA/DE) — pomocnik dla strony edycji. */
export async function listTranslations(parentId: string): Promise<TranslationRow[]> {
  const rows = await prisma.faq.findMany({
    where: { parent_id: parentId },
    orderBy: { language: 'asc' },
    select: {
      id: true,
      parent_id: true,
      language: true,
      question: true,
      answer: true,
      answer_voice: true,
      manually_edited: true,
      auto_translated_at: true,
      updated_at: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id!,
    language: r.language,
    question: r.question,
    answer: r.answer,
    answerVoice: r.answer_voice,
    manuallyEdited: r.manually_edited,
    autoTranslatedAt: r.auto_translated_at,
    updatedAt: r.updated_at,
  }))
}
