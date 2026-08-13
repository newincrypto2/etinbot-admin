import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getFaqById, listCategories, listTranslations } from '@/queries/faq'
import { getVertical } from '@/queries/client'
import { updateFaq } from '@/actions/faq'
import { FaqForm } from '../../_components/FaqForm'
import { TranslationsSection } from './_components/TranslationsSection'
import { activeClientSlug } from '@/lib/tenant'
import { requireRole } from '@/lib/auth-helpers'


export default async function EditFaqPage(props: { params: Promise<{ id: string }> }) {
  await requireRole('EDITOR')
  const { id } = await props.params
  const [faq, categories, translations, vertical] = await Promise.all([
    getFaqById(id),
    listCategories((await activeClientSlug())),
    listTranslations(id),
    getVertical((await activeClientSlug())),
  ])
  if (!faq) notFound()
  const buildings = vertical === 'rental' ? await (await import('@/queries/buildings')).getBuildings() : []

  // Bind id do server action
  const updateAction = updateFaq.bind(null, id)

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/faq"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć do listy
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Edycja FAQ</h1>
        <p className="text-sm text-slate-600 mt-1">
          Master po polsku. Po zapisie tłumaczenia (EN/UA/DE) zostaną automatycznie odświeżone
          — z wyjątkiem tych, które ręcznie edytowałeś.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <FaqForm
          action={updateAction}
          initial={{
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            scope: faq.scope as any,
            isActive: faq.isActive ?? true,
            answerVoice: faq.answerVoice,
          }}
          categories={categories}
          submitLabel="Zapisz zmiany"
          vertical={vertical}
          buildings={buildings}
        />
      </div>

      <TranslationsSection
        parentId={id}
        masterUpdatedAt={faq.updatedAt}
        translations={translations}
      />
    </div>
  )
}
