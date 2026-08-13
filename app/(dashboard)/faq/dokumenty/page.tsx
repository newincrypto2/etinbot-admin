import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'

import { getCurrentPermissions } from '@/lib/permissions'
import { DocumentsManager } from './_components/DocumentsManager'

export const dynamic = 'force-dynamic'

export default async function KbDocumentsPage() {
  const permissions = await getCurrentPermissions()
  const canEdit = permissions['faq.manage']

  return (
    <div className="max-w-4xl space-y-6">
      <header className="space-y-2">
        <Link href="/faq" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Wróć do FAQ
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 inline-flex items-center gap-2">
          <FileText className="h-6 w-6 text-indigo-500" /> Import z dokumentów
        </h1>
        <p className="text-sm text-slate-600">
          Wrzuć dokumenty (regulamin, cennik, opisy produktów — PDF, DOCX, TXT, MD, do 5 MB).
          System przetworzy je w tle: sztuczna inteligencja wyciągnie z nich pary pytanie–odpowiedź,
          policzy koszt przetwarzania i doda wpisy prosto do FAQ. Powstałe wpisy możesz{' '}
          <Link href="/faq" className="text-indigo-600 hover:underline">edytować lub usuwać</Link>{' '}
          tak jak każde inne. Jeśli import się nie uda albo wynik Ci nie pasuje — użyj „Cofnij import&rdquo;.
        </p>
      </header>

      <DocumentsManager canEdit={canEdit} />
    </div>
  )
}
