/**
 * Translator helper — Claude Haiku tłumaczy Q+A+voice na docelowy język w jednym call.
 *
 * Server-only. Używane w actions/faq.ts przy save mastera PL.
 */

import Anthropic from '@anthropic-ai/sdk'

export type TargetLang = 'en' | 'uk' | 'de'

const LANG_NAMES: Record<TargetLang, string> = {
  en: 'English',
  uk: 'Ukrainian (українська)',
  de: 'German (Deutsch)',
}

const SYSTEM = `Tłumaczysz pytania i odpowiedzi z bazy FAQ aparthotelu.

Zwracasz STRICT JSON w formacie:
{"question": "...", "answer": "...", "answer_voice": "..."}

Zasady:
- Tłumacz na język docelowy zachowując ton.
- answer_voice: maksymalnie 2 zdania, naturalna mowa.
- ZACHOWAJ konkretne dane 1:1: kwoty (30 zł zostaje "30 zł" / "30 PLN"),
  godziny, numery telefonów, kody, nazwy własne ("Silver Place", "Silver Forest").
- NIE używaj nawiasów ani list w answer_voice.
- NIE dodawaj komentarzy poza JSON.`

let _anthropic: Anthropic | null = null
function client(): Anthropic {
  if (_anthropic) return _anthropic
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

export type Translation = {
  question: string
  answer: string
  answerVoice: string
}

export async function translateFaq(
  question: string,
  answer: string,
  answerVoice: string | null,
  targetLang: TargetLang,
): Promise<Translation> {
  const userMsg = `Język docelowy: ${LANG_NAMES[targetLang]}

Polskie pytanie:
${question}

Polska odpowiedź pełna:
${answer}

Polska odpowiedź skrócona (głosowa):
${answerVoice ?? '(brak — wygeneruj nową max 2 zdania)'}

Zwróć JSON z tłumaczeniem.`

  const resp = await client().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  const block = resp.content[0]
  if (block.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  let text = block.text.trim()
  // Czasem Claude zwraca z ```json ... ```
  if (text.startsWith('```')) {
    const lines = text.split('\n')
    text = lines.slice(1, lines[lines.length - 1].startsWith('```') ? -1 : undefined).join('\n')
  }

  const data = JSON.parse(text)
  return {
    question: (data.question ?? '').trim(),
    answer: (data.answer ?? '').trim(),
    answerVoice: (data.answer_voice ?? '').trim(),
  }
}

export const TARGET_LANGUAGES: TargetLang[] = ['en', 'uk', 'de']
