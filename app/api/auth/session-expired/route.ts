import { signOut } from '@/lib/auth'

/**
 * Realne wylogowanie (czyszczenie cookie JWT) po wykryciu sessionVersion
 * mismatch — patrz lib/auth-helpers.ts requireAuth(). Zwykły redirect('/login')
 * z Server Component by nie wystarczył: cookie JWT zostałby ważny czasowo,
 * middleware widziałby isLoggedIn=true i odbijałby z /login z powrotem do
 * środka (pętla). signOut() w Route Handler MOŻE mutować cookies.
 */
export async function GET() {
  await signOut({ redirectTo: '/login?wygasla=1' })
}
