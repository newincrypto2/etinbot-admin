const SERVICE_LABEL: Record<string, string> = {
  elevenlabs_voice: 'ElevenLabs voice',
  twilio_voice_in: 'Twilio voice (incoming)',
  twilio_sms_out: 'Twilio SMS (outbound)',
  twilio_sms_in: 'Twilio SMS (inbound)',
  anthropic_messages: 'Claude (Anthropic)',
  openai_embedding: 'OpenAI embeddings',
}

/**
 * Marża doliczana do kosztu zmiennego pobranego z systemów dostawców.
 * Env: BILLING_MARGIN_PCT (default 20%). 0 = wyłączone (panel pokazuje czyste koszty).
 *
 * UWAGA: tabela `conversation_costs` trzyma realne (net) kwoty 1:1 z dostawcami.
 * Marża aplikowana TYLKO na warstwie prezentacji (panel + CSV).
 */
export function getMarginPct(): number {
  const raw = process.env.BILLING_MARGIN_PCT
  if (raw === undefined || raw === '') return 20
  const n = parseFloat(raw)
  return Number.isFinite(n) && n >= 0 ? n : 20
}

export function getMarginMultiplier(): number {
  return 1 + getMarginPct() / 100
}

/** Pomnóż kwotę przez (1 + marża/100). Przyjmuje string|number, zwraca number. */
export function withMargin(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return null
  return n * getMarginMultiplier()
}

const UNIT_LABEL: Record<string, string> = {
  minutes: 'min',
  sms_segments: 'segm.',
  tokens: 'tok',
}

export function serviceName(service: string): string {
  return SERVICE_LABEL[service] ?? service
}

export function unitLabel(unitType: string): string {
  return UNIT_LABEL[unitType] ?? unitType
}

/** Liczba → PLN string z 2 lub 4 miejscami zależnie od wielkości.
 *  Dla wartości > 0 ale < 0,0001 zwraca "<0,0001 PLN" zamiast bezsensowengo "0,0000 PLN". */
export function fmtPln(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  if (n > 0 && n < 0.0001) return '<0,0001 PLN'
  const precision = Math.abs(n) >= 0.1 ? 2 : 4
  return `${n.toLocaleString('pl-PL', { minimumFractionDigits: precision, maximumFractionDigits: precision })} PLN`
}

export function fmtUsd(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  const precision = Math.abs(n) >= 0.01 ? 4 : 6
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })}`
}

export function fmtUnits(value: string | number | null | undefined, unitType: string): string {
  if (value === null || value === undefined) return '—'
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  if (unitType === 'minutes') {
    return `${n.toFixed(2)} ${unitLabel(unitType)}`
  }
  if (unitType === 'tokens') {
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}k ${unitLabel(unitType)}`
    }
    return `${Math.round(n)} ${unitLabel(unitType)}`
  }
  return `${Math.round(n)} ${unitLabel(unitType)}`
}
