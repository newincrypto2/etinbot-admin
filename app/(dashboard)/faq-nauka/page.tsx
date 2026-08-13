import { GraduationCap } from 'lucide-react'

import { listFaqCandidates } from '@/queries/email'
import { CandidateCard } from './_components/CandidateCard'
import { activeClientSlug } from '@/lib/tenant'
import { getCurrentRole, hasRole } from '@/lib/auth-helpers'


export default async function FaqNaukaPage() {
  const [candidates, role] = await Promise.all([
    listFaqCandidates({ clientSlug: (await activeClientSlug()), status: 'pending' }),
    getCurrentRole(),
  ])
  const canEdit = hasRole(role, 'EDITOR')

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 inline-flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-indigo-500" /> Nauka FAQ
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Gdy edytujesz draft bota, piszesz quick-reply albo odpisujesz na coś, czego bot nie był
          pewien — z wysłanej odpowiedzi powstaje kandydat do bazy wiedzy. Bot sam destyluje
          uogólnioną parę pytanie→odpowiedź. Ty zatwierdzasz (lub poprawiasz) jednym kliknięciem,
          a bot uczy się na przyszłość.
        </p>
      </header>

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Brak kandydatów do przeglądu. Pojawią się tu automatycznie, gdy poprawisz lub napiszesz
          odpowiedź w Poczcie.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{candidates.length} kandydat(ów) do przeglądu</p>
          {candidates.map((c) => (
            <CandidateCard key={c.id} c={c} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
