/**
 * Formatowanie dat w strefie Europe/Warsaw.
 *
 * Serwer (Coolify VPS) działa w UTC, więc bez explicit timezone wszystkie
 * `toLocaleString()` w SSR renderują UTC zamiast Warsaw — co dawało
 * "09:03" zamiast "11:03" przy rozmowie z 2026-05-20 11:02 lokalnego.
 */

const TZ = 'Europe/Warsaw'

export function fmtDateTime(d: Date): string {
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}

export function fmtDateTimeSec(d: Date): string {
  return d.toLocaleString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: TZ,
  })
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TZ,
  })
}

export function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  })
}

export function fmtFullDateTime(d: Date): string {
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}
