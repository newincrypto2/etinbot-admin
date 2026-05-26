import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
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
