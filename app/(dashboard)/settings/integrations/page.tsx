import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

import { requireRole } from '@/lib/auth-helpers'
import { getClientSettings, listIdobookingCreds, type IdoBookingCreds } from '@/queries/client'
import { upsertIdobookingCreds } from '@/actions/client'
import { fmtDateTime } from '@/lib/datetime'
import { IdobookingForm } from './_components/IdobookingForm'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

const SCOPE_META: Record<string, { label: string; description: string; color: string }> = {
  'silver-place': {
    label: 'Silver Place',
    description: 'ul. Niemierzyńska 1, Szczecin',
    color: 'bg-blue-50 border-blue-200',
  },
  'silver-forest': {
    label: 'Silver Forest',
    description: 'Szczecin (przy lesie)',
    color: 'bg-emerald-50 border-emerald-200',
  },
}

export default async function IntegrationsSettingsPage() {
  await requireRole('OWNER')
  const [settings, creds] = await Promise.all([
    getClientSettings(CLIENT_SLUG),
    listIdobookingCreds(CLIENT_SLUG),
  ])
  if (!settings) return <div className="p-8 text-slate-500">Brak danych klienta.</div>

  const credsByScope: Record<string, IdoBookingCreds | undefined> = {
    'silver-place': creds.find((c) => c.scope === 'silver-place'),
    'silver-forest': creds.find((c) => c.scope === 'silver-forest'),
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do ustawień
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Integracje</h1>
        <p className="text-sm text-slate-600 mt-1">
          Każdy budynek ma własne konto IdoBooking — credentials konfigurujesz osobno.
        </p>
      </header>

      <div className="space-y-4">
        {(['silver-place', 'silver-forest'] as const).map((scope) => {
          const meta = SCOPE_META[scope]
          const cred = credsByScope[scope]
          return (
            <div key={scope} className={`rounded-lg border-2 ${meta.color} p-5`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{meta.label}</h2>
                    {cred?.isActive ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : cred ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </div>
                {cred && (
                  <div className="text-right text-xs text-slate-500">
                    {cred.lastSyncAt ? (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        sync: {fmtDateTime(cred.lastSyncAt)}
                      </div>
                    ) : (
                      <span>brak sync</span>
                    )}
                    {cred.lastError && (
                      <div className="text-red-600 mt-1 max-w-xs truncate" title={cred.lastError}>
                        ⚠ {cred.lastError.slice(0, 60)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <IdobookingForm
                action={upsertIdobookingCreds}
                scope={scope}
                initial={{
                  tenant: cred?.tenant ?? '',
                  systemLogin: cred?.systemLogin ?? '',
                  hasPassword: cred?.hasPassword ?? false,
                  isActive: cred?.isActive ?? true,
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900 mb-2">ElevenLabs (voice bot)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Identyfikator agenta Conversational AI w ElevenLabs. Bot głosowy używa go żeby zawołać <code className="font-mono">/api/kb/search</code>.
        </p>
        {settings.hasElevenlabsAgent ? (
          <div className="text-xs text-emerald-700">✓ podpięty (edycja na razie przez ENV Coolify)</div>
        ) : (
          <div className="text-xs text-slate-500">— nie skonfigurowany. Wpisz Agent ID w env vars Coolify gdy ElevenLabs będzie gotowy.</div>
        )}
      </div>
    </div>
  )
}
