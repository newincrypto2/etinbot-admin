'use client'
import { signIn } from 'next-auth/react'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LogIn, Loader2 } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  // Ustawiane przez app/api/auth/session-expired — zmiana roli/uprawnień/reset
  // hasła unieważniła poprzednią sesję (patrz lib/auth-helpers.ts sessionVersion).
  const sessionExpired = searchParams.get('wygasla') === '1'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      setError('Nieprawidłowy email lub hasło')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-500 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">EtinBOT</h1>
          <p className="text-sm text-gray-500 mt-1">Panel administracyjny — zaloguj się</p>
        </div>

        {sessionExpired && (
          <div className="mb-4 text-sm text-amber-700 text-center bg-amber-50 border border-amber-200 py-2 px-3 rounded-lg">
            Twoja sesja wygasła (zmieniono rolę, uprawnienia lub hasło) — zaloguj się ponownie.
          </div>
        )}

        <Card className="shadow-sm border-gray-200/60">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@email.pl"
                  required
                  autoComplete="email"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10"
                />
              </div>
              {error && (
                <div className="text-sm text-red-500 text-center bg-red-50 py-2 rounded-lg">{error}</div>
              )}
              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Zaloguj się
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
