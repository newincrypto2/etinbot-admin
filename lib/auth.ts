import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/lib/auth.config'
import { loginLimiter } from '@/lib/rate-limit'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Hasło', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Brute-force guard — limit prób per email (in-memory, single instance)
        const limiterKey = (credentials.email as string).toLowerCase().trim()
        if (!loginLimiter.check(`login:${limiterKey}`).success) {
          console.warn(`[auth] rate limit hit for login ${limiterKey}`)
          return null
        }

        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
})
