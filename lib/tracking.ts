// lib/tracking.ts — jedno źródło prawdy dla linków śledzenia przesyłek w panelu
// (karta konwersacji + sidebar poczty). Czysta funkcja, bez zależności serwerowych.
//
// Kolejność ustalania URL-a trackingu u callerów (NIE tutaj):
//   1. tracking_url z DB (orders_cache.tracking_url) — ZAWSZE ma pierwszeństwo,
//   2. courierTrackingUrl(delivery_method/courier, tracking_number) — ta funkcja,
//   3. brak dopasowania → null → UI pokazuje numer bez linku (nie zgadujemy URL-i).

type CourierRule = {
  /** Podstringi (lowercase) szukane w courierHint, np. "Kurier DPD - pobranie". */
  keywords: string[]
  buildUrl: (encodedNr: string) => string
}

// Dodanie kolejnego kuriera = jeden wpis w tej tablicy.
const COURIER_RULES: CourierRule[] = [
  { keywords: ['dpd'], buildUrl: (nr) => `https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=${nr}` },
  { keywords: ['inpost', 'paczkomat'], buildUrl: (nr) => `https://inpost.pl/sledzenie-przesylek?number=${nr}` },
  { keywords: ['dhl'], buildUrl: (nr) => `https://www.dhl.com/pl-pl/home/tracking.html?tracking-id=${nr}` },
  { keywords: ['gls'], buildUrl: (nr) => `https://gls-group.eu/PL/pl/sledzenie-paczek?match=${nr}` },
  { keywords: ['poczta polska', 'pocztex'], buildUrl: (nr) => `https://emonitoring.poczta-polska.pl/?numer=${nr}` },
  { keywords: ['ups'], buildUrl: (nr) => `https://www.ups.com/track?tracknum=${nr}` },
  { keywords: ['fedex'], buildUrl: (nr) => `https://www.fedex.com/fedextrack/?trknbr=${nr}` },
  { keywords: ['orlen'], buildUrl: (nr) => `https://www.orlenpaczka.pl/sledz-paczke/?numer=${nr}` },
]

/** Buduje URL strony śledzenia kuriera na podstawie nazwy metody dostawy/kuriera
 *  (dopasowanie po podstringu, case-insensitive). Gdy hint nie pasuje — heurystyka
 *  po FORMACIE numeru (DPD PL / InPost). Brak sensownego dopasowania → null. */
export function courierTrackingUrl(
  courierHint: string | null | undefined,
  trackingNumber: string,
): string | null {
  const nr = (trackingNumber ?? '').trim()
  if (!nr) return null
  const enc = encodeURIComponent(nr)

  const hint = (courierHint ?? '').toLowerCase()
  if (hint) {
    for (const rule of COURIER_RULES) {
      if (rule.keywords.some((k) => hint.includes(k))) return rule.buildUrl(enc)
    }
  }

  // Heurystyki po formacie numeru (fallback, gdy courierHint pusty/nierozpoznany):
  // - DPD PL: same cyfry zakończone literą, np. "1044967850806U"
  if (/^\d{10,14}[A-Za-z]$/.test(nr)) {
    return `https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=${enc}`
  }
  // - InPost: 24 cyfry zaczynające się od 6209
  if (/^6209\d{20}$/.test(nr)) {
    return `https://inpost.pl/sledzenie-przesylek?number=${enc}`
  }

  return null // nie wymyślamy URL-a — UI pokaże numer bez linku
}
