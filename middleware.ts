import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

// Kanoniczna domena panelu (od 17.08.2026). Stara domena Coolify zostaje
// podpięta do aplikacji i robi trwałe przekierowanie — dzięki temu nie umierają
// linki w mailach/SMS-ach eskalacyjnych ani zakładki w przeglądarkach.
const CANONICAL_HOST = 'panel.etinbot.pl'
const LEGACY_HOSTS = new Set(['etinbotadmin.dewflow.cloud'])

export default auth((req) => {
  // Przekierowanie ze starej domeny — PRZED logiką sesji, żeby łapało też
  // /api/auth i /login (cookies są host-only, więc sesja i tak jest per domena).
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase()
  if (LEGACY_HOSTS.has(host)) {
    const target = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      `https://${CANONICAL_HOST}`,
    )
    // 301 dla nawigacji (zakładki, linki, SEO). Dla POST/PUT 308 — 301 kazałby
    // przeglądarce zamienić metodę na GET i po cichu zgubić body formularza.
    const status = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308
    return NextResponse.redirect(target, status)
  }

  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  // Endpointy z własną autoryzacją (secret header lub session) — przepuść
  if (pathname.startsWith('/api/webhooks')) return NextResponse.next()
  if (pathname.startsWith('/api/auth')) return NextResponse.next()

  // Strona logowania
  if (pathname === '/login') {
    if (isLoggedIn) return NextResponse.redirect(new URL('/', req.nextUrl))
    return NextResponse.next()
  }

  // Wszystko inne wymaga logowania
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // Role-based gates są w server components (requireAdmin) — middleware tylko isLoggedIn.
  // Powód: middleware działa na Edge runtime bez dostępu do DB, a stary JWT
  // może nie mieć role w tokenie. Server component robi DB fallback po emailu.

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
