import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { listCategories } from '@/queries/faq'
import { getVertical } from '@/queries/client'
import { createFaq } from '@/actions/faq'
import { FaqForm } from '../_components/FaqForm'
import { activeClientSlug } from '@/lib/tenant'


export default async function NewFaqPage() {
  const [categories, vertical] = await Promise.all([
    listCategories((await activeClientSlug())),
    getVertical((await activeClientSlug())),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/faq"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć do listy
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Nowe pytanie FAQ</h1>
        <p className="text-sm text-slate-600 mt-1">
          Embedding i krótka wersja głosowa zostaną wygenerowane automatycznie po zapisie.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <FaqForm
          action={createFaq}
          categories={categories}
          submitLabel="Utwórz"
          vertical={vertical}
        />
      </div>
    </div>
  )
}
