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
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
}
