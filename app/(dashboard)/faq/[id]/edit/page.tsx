import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getFaqById, listCategories, listTranslations } from '@/queries/faq'
import { updateFaq } from '@/actions/faq'
import { FaqForm } from '../../_components/FaqForm'
import { TranslationsSection } from './_components/TranslationsSection'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

export default async function EditFaqPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const [faq, categories, translations] = await Promise.all([
    getFaqById(id),
    listCategories(CLIENT_SLUG),
    listTranslations(id),
  ])
  if (!faq) notFound()

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
