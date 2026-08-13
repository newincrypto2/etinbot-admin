import Link from 'next/link'
import { Users, Key, MessageSquareText, Phone } from 'lucide-react'

import { requirePermission } from '@/lib/permissions'
import { getClientSettings, getEcommerceIntegrations } from '@/queries/client'
import { activeClientSlug } from '@/lib/tenant'


export default async function SettingsPage() {
  await requirePermission('settings.manage')
  const settings = await getClientSettings((await activeClientSlug()))

  if (!settings) {
    return <div className="p-8 text-slate-500">Brak danych klienta.</div>
  }

  const isEcom = settings.vertical === 'ecommerce'
  const ecom = isEcom ? await getEcommerceIntegrations((await activeClientSlug())) : null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Ustawienia</h1>
        <p className="text-sm text-slate-600 mt-1">
          Konfiguracja bota dla {settings.name} — branding, eskalacje, integracje.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingsCard
          href="/settings/brand"
          icon={<MessageSquareText className="h-5 w-5" />}
          title="Branding bota"
          description={`${settings.botName ?? 'Asystent'} · ${settings.botPersona === 'casual' ? 'ton luźny' : 'ton formalny'} · ${settings.primaryLanguage.toUpperCase()}`}
        />
        <SettingsCard
          href="/settings/escalation"
          icon={<Phone className="h-5 w-5" />}
          title="Eskalacja"
          description={
            <>
              {settings.escalationPhoneOffice && <div>Biuro: {settings.escalationPhoneOffice}</div>}
              {settings.escalationPhoneSecurity && <div>{isEcom ? 'Numer alarmowy' : 'Ochrona 24/7'}: {settings.escalationPhoneSecurity}</div>}
              {settings.escalationEmail && <div>Email: {settings.escalationEmail}</div>}
            </>
          }
        />
        <SettingsCard
          href="/settings/integrations"
          icon={<Key className="h-5 w-5" />}
          title="Integracje"
          description={
            isEcom ? (
              <>
                <div>BaseLinker: {ecom?.baselinkerTokenSet ? '✓ token ustawiony' : (ecom?.ordersCount ?? 0) > 0 ? '✓ działa (token w env backendu)' : '✗ brak tokena'}</div>
                <div>WooCommerce: {ecom?.wcUrl ? `✓ ${ecom.wcUrl}` : '✗ nie skonfigurowane'}</div>
                <div>Sync: {ecom?.ordersCount ?? 0} zamówień · {ecom?.productsCount ?? 0} produktów</div>
              </>
            ) : (
              <>
                <div>IdoBooking: {settings.idobookingTenant ? `${settings.idobookingTenant}.idosell.com` : '— nie skonfigurowane'}</div>
                <div>API key: {settings.hasIdobookingApiKey ? '✓ ustawiony' : '✗ brak'}</div>
                <div>ElevenLabs: {settings.hasElevenlabsAgent ? '✓ podpięty' : '✗ brak'}</div>
              </>
            )
          }
        />
        <SettingsCard
          href="/settings/users"
          icon={<Users className="h-5 w-5" />}
          title="Użytkownicy panelu"
          description="Zarządzaj kontami które mają dostęp do tego panelu (superadmin / operator / editor / viewer)"
        />
      </div>
    </div>
  )
}

function SettingsCard({ href, icon, title, description }: {
  href: string
  icon: React.ReactNode
  title: string
  description: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-medium text-slate-900">{title}</div>
          <div className="text-xs text-slate-500 mt-1 space-y-0.5">{description}</div>
        </div>
      </div>
    </Link>
  )
}
