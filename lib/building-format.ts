// Formatowanie kodów budynków (rental) — CZYSTE funkcje, bezpieczne w client
// components (bez prisma). Kody budynków są per-tenant (apartments.building_code,
// wolny string kebab-case) — ŻADNYCH hardkodowanych nazw typu Silver Place.

/** 'silver-place' → 'Silver Place'; 'both'/'all' → 'Wszystkie budynki'. */
export function buildingLabel(code: string | null | undefined): string {
  if (!code) return '—'
  if (code === 'both' || code === 'all') return 'Wszystkie budynki'
  return code
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

const PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
  'bg-rose-100 text-rose-700',
]

/** Deterministyczny kolor badge'a per kod budynku (stabilny między renderami). */
export function buildingColor(code: string | null | undefined): string {
  if (!code || code === 'both' || code === 'all') return 'bg-slate-100 text-slate-700'
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export type BuildingOption = { code: string; label: string }
