import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireRole } from '@/lib/auth-helpers'
import { getClientSettings } from '@/queries/client'
import { updateBrand } from '@/actions/client'
import { BrandForm } from './_components/BrandForm'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

export default async function BrandSettingsPage() {
  await requireRole('OWNER')
  const settings = await getClientSettings(CLIENT_SLUG)
  if (!settings) return <div className="p-8 text-slate-500">Brak danych klienta.</div>

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do ustawień
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Branding bota</h1>
        <p className="text-sm text-slate-600 mt-1">
          Jak bot przedstawia się gościom i jakim tonem rozmawia.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <BrandForm
          action={updateBrand}
          initial={{
            botName: settings.botName ?? 'Asystent',
            botPersona: (settings.botPersona ?? 'formal') as any,
            primaryLanguage: settings.primaryLanguage as any,
          }}
        />
      </div>
    </div>
  )
}
