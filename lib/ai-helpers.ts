/**
 * AI helpers — embeddings (OpenAI) + answer_voice shortening (Claude Haiku).
 *
 * Tylko po stronie server actions / API routes. NIE importować do client components.
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const EMBED_MODEL = 'text-embedding-3-small'
const HAIKU_MODEL = 'claude-haiku-4-5'

let _openai: OpenAI | null = null
let _anthropic: Anthropic | null = null

function openai(): OpenAI {
  if (_openai) return _openai
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

function anthropic(): Anthropic {
  if (_anthropic) return _anthropic
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

/** Embedding dla pojedynczego tekstu (FAQ Q+A combined). */
export async function embed(text: string): Promise<number[]> {
  const resp = await openai().embeddings.create({
    model: EMBED_MODEL,
    input: text,
  })
  return resp.data[0].embedding
}

/** Konwertuj wektor do pgvector literalu — '[0.1,0.2,...]'. */
export function vectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

const VOICE_SYSTEM = `Zwracasz krótkie wersje odpowiedzi dla bota głosowego aparthotelu.

Zasady:
- Maksymalnie 2 zdania.
- Naturalna mowa po polsku (nie czytaj jak tekst).
- Zachowaj wszystkie konkretne fakty: godziny, kwoty, numery telefonów, kody.
- NIE używaj nawiasów, list, znaków specjalnych.
- NIE dodawaj "Witam" / "Dziękuję".

Zwróć TYLKO skróconą treść — nic więcej.`

/** Generuj krótką wersję answer_voice (max 2 zdania) przez Claude Haiku. */
export async function shortenForVoice(question: string, answer: string): Promise<string> {
  const resp = await anthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    system: VOICE_SYSTEM,
    messages: [{
      role: 'user',
      content: `Pytanie: ${question}\n\nPełna odpowiedź: ${answer}\n\nSkrócona wersja:`,
    }],
  })
  const block = resp.content[0]
  if (block.type !== 'text') return ''
  return block.text.trim()
}
