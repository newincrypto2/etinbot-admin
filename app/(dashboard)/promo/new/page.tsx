import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { requireModule } from '@/lib/modules-server'
import { PromoBarForm } from '../_components/PromoBarForm'

export default async function NewPromoPage() {
  await requireAuth()
  await requireModule('promobar')
  return (
    <div className="space-y-6">
      <Link href="/promo" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Wróć do listy
      </Link>
      <h1 className="text-xl font-semibold">Nowa kampania paska</h1>
      <PromoBarForm />
    </div>
  )
}
