import type { NextAuthConfig } from 'next-auth'

// Edge-safe config — bez bcrypt i prisma
// Używany przez middleware (Edge runtime)
export const authConfig: NextAuthConfig = {
  // Niezbędne dla deployu za reverse-proxy (Traefik/Coolify) — bez tego
  // Auth.js v5 rzuca UntrustedHost na każdy request.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.clientId = (user as any).clientId ?? null
        // sessionVersion — patrz lib/auth-helpers.ts getFreshSessionUser().
        // Brak w tokenach sprzed tej migracji = undefined → traktowane jako 0.
        token.sessionVersion = (user as any).sessionVersion ?? 0
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      ;(session.user as any).clientId = (token.clientId as string | null) ?? null
      ;(session.user as any).sessionVersion = (token.sessionVersion as number | undefined) ?? 0
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
}
