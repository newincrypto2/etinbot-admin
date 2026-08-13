import Link from 'next/link'
import { ArrowLeft, Bell } from 'lucide-react'

import { requireRole } from '@/lib/auth-helpers'
import { getClientSettings } from '@/queries/client'
import { listEscalationRecipients } from '@/queries/notifications'
import { updateEscalation } from '@/actions/client'
import { upsertEscalationRecipient, deleteEscalationRecipient } from '@/actions/notifications'
import { EscalationForm } from './_components/EscalationForm'
import { RecipientsList } from './_components/RecipientsList'
import { activeClientSlug } from '@/lib/tenant'
import { getVertical } from '@/queries/client'
import { getBuildings } from '@/queries/buildings'


export default async function EscalationSettingsPage() {
  await requireRole('OWNER')
  const [settings, recipients, vertical] = await Promise.all([
    getClientSettings((await activeClientSlug())),
    listEscalationRecipients((await activeClientSlug())),
    getVertical((await activeClientSlug())),
  ])
  if (!settings) return <div className="p-8 text-slate-500">Brak danych klienta.</div>
  const buildings = vertical === 'rental' ? await getBuildings() : []

  return (
    <div className="max-w-3xl space-y-8">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do ustawień
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Eskalacja</h1>
        <p className="text-sm text-slate-600 mt-1">
          Powiadomienia SMS dla obsługi + numery, które bot pokazuje {vertical === 'ecommerce' ? 'klientowi' : 'gościowi'}.
        </p>
      </header>

      {/* SEKCJA 1: Odbiorcy SMS — kto dostaje alarm przy eskalacji */}
      <section className="space-y-3">
        <div className="flex items-start gap-2">
          <Bell className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-slate-900">Odbiorcy SMS przy eskalacji</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bot wyśle SMS do każdego aktywnego odbiorcy pasującego do filtra
              ({vertical === 'ecommerce' ? 'ważność' : 'budynek + ważność'}).
              SMS zawiera podsumowanie sprawy + link do konwersacji w panelu.
            </p>
          </div>
        </div>
        <RecipientsList
          recipients={recipients}
          upsertAction={upsertEscalationRecipient}
          deleteAction={deleteEscalationRecipient}
          vertical={vertical}
          buildings={buildings}
        />
      </section>

      {/* SEKCJA 2: Numery pokazywane gościowi/klientowi (display only) */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-1">
        <h2 className="font-semibold text-slate-900">
          Numery dla {vertical === 'ecommerce' ? 'klienta' : 'gościa'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          To są numery, które bot <strong>cytuje {vertical === 'ecommerce' ? 'klientowi' : 'gościowi'}</strong> w odpowiedzi po eskalacji
          (np. „Sprawa przekazana, oddzwonią lub zadzwoń sam: +48..."). Nie chodzi tu o to,
          kto dostaje SMS — tym zajmuje się sekcja wyżej.
        </p>
        <EscalationForm
          action={updateEscalation}
          vertical={vertical}
          initial={{
            escalationPhoneOffice: settings.escalationPhoneOffice ?? '',
            escalationPhoneSecurity: settings.escalationPhoneSecurity ?? '',
            escalationEmail: settings.escalationEmail ?? '',
          }}
        />
      </section>
    </div>
  )
}
