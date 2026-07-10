import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, Package, ShoppingCart, MessageCircle, AlertTriangle, Mail, HelpCircle, Users, CheckCircle2,
} from 'lucide-react'

import { requireRole } from '@/lib/auth-helpers'
import { getClientBySlug, getClientConfigForms, getTenantHealth, listClientUsers } from '@/queries/clients'
import { fmtFullDateTime } from '@/lib/datetime'
import { ChannelBadges } from '../_components/ChannelBadges'
import { ClientHeaderActions } from './_components/ClientHeaderActions'
import { RefreshButton } from './_components/RefreshButton'
import { TestIntegrationButton } from './_components/TestIntegrationButton'
import { PromptExtraForm } from './_components/PromptExtraForm'
import { SandboxChat } from './_components/SandboxChat'
import { ConfigViewer } from './_components/ConfigViewer'
import { ConfigForms } from './_components/ConfigForms'
import { AllegroConnect } from './_components/AllegroConnect'
import { SwitchAndSettingsLink } from './_components/SwitchAndSettingsLink'
import { IdoBookingCreds } from './_components/IdoBookingCreds'
import { listIdoBookingCredentials } from '@/actions/idobooking'

type Params = Promise<{ id: string }>
type Search = Promise<{ tab?: string }>

const TABS = [
  { key: 'overview', label: 'Przegląd' },
  { key: 'integrations', label: 'Integracje' },
  { key: 'prompt', label: 'Prompt & sandbox' },
  { key: 'users', label: 'Użytkownicy' },
  { key: 'config', label: 'Konfiguracja' },
]

const INTEGRATION_LABELS: { key: string; label: string; testable?: 'woocommerce' | 'baselinker' | 'email' | 'messenger' | 'allegro' }[] = [
  { key: 'woocommerce', label: 'WooCommerce', testable: 'woocommerce' },
  { key: 'baselinker', label: 'BaseLinker', testable: 'baselinker' },
  { key: 'email', label: 'E-mail', testable: 'email' },
  { key: 'messenger', label: 'Messenger', testable: 'messenger' },
  { key: 'allegro', label: 'Allegro', testable: 'allegro' },
  { key: 'twilio_sms', label: 'Twilio SMS' },
  { key: 'voice', label: 'Voice (ElevenLabs)' },
  { key: 'webchat', label: 'Webchat' },
]

function fmtIso(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : fmtFullDateTime(d)
}

export default async function ClientCardPage(props: { params: Params; searchParams: Search }) {
  await requireRole('SUPERADMIN')
  const { id: slug } = await props.params
  const { tab: tabParam } = await props.searchParams
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : 'overview'

  const client = await getClientBySlug(slug)
  if (!client) notFound()

  const needHealth = tab === 'overview' || tab === 'integrations'
  const healthRes = needHealth ? await getTenantHealth(slug) : null
  const users = tab === 'users' ? await listClientUsers(client.id) : []
  const configForms =
    tab === 'config' || tab === 'integrations' ? await getClientConfigForms(slug) : null
  // IdoBooking creds — tylko rental, tylko na zakładce Integracje.
  const idoCreds =
    tab === 'integrations' && client.vertical === 'rental' ? await listIdoBookingCredentials(slug) : null

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div>
        <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Klienci
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-1">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-900">{client.name}</h1>
              {client.vertical === 'ecommerce' ? (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">e-commerce</span>
              ) : client.vertical === 'rental' ? (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">rental</span>
              ) : null}
              {client.active ? (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Aktywny</span>
              ) : (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Nieaktywny</span>
              )}
            </div>
            <div className="text-sm text-slate-400 mt-0.5">{client.slug}</div>
          </div>
          <ClientHeaderActions slug={client.slug} active={client.active} />
        </div>
      </div>

      {/* Zakładki */}
      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${slug}?tab=${t.key}`}
            className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── PRZEGLĄD ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Stan tenanta</h2>
            <RefreshButton />
          </div>
          {healthRes && !healthRes.ok && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">{healthRes.error}</div>
          )}
          {healthRes && healthRes.ok && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={healthRes.health.status} />
                <ChannelBadges channels={client.channels} />
              </div>
              {healthRes.health.problems.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-amber-800 mb-1">Wykryte problemy</div>
                  <ul className="text-sm text-amber-900 list-disc pl-5 space-y-0.5">
                    {healthRes.health.problems.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              ) : (
                <div className="text-sm text-emerald-700 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Brak wykrytych problemów.
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Tile icon={<Package className="h-4 w-4" />} label="Produkty" value={healthRes.health.products.total_active} sub={`${healthRes.health.products.with_embedding} z embeddingiem`} />
                <Tile icon={<ShoppingCart className="h-4 w-4" />} label="Zamówienia" value={healthRes.health.orders.total} sub={`sync: ${fmtIso(healthRes.health.orders.last_sync)}`} />
                <Tile icon={<MessageCircle className="h-4 w-4" />} label="Rozmowy 7 dni" value={healthRes.health.conversations.last_7d} sub={`łącznie ${healthRes.health.conversations.total}`} />
                <Tile icon={<AlertTriangle className="h-4 w-4" />} label="Eskalacje" value={healthRes.health.escalations.open} sub={`otwarte · 7d: ${healthRes.health.escalations.last_7d}`} />
                <Tile icon={<Mail className="h-4 w-4" />} label="Skrzynki" value={healthRes.health.email.mailboxes} sub={healthRes.health.email.stuck ? `${healthRes.health.email.stuck} zawieszonych` : 'ok'} />
                <Tile icon={<HelpCircle className="h-4 w-4" />} label="FAQ" value={healthRes.health.faq_entries} sub="wpisów" />
              </div>
              <div className="text-xs text-slate-400">
                Produkty — ostatni sync: {fmtIso(healthRes.health.products.last_sync)} · Utworzony: {fmtIso(healthRes.health.created_at)} · Sprawdzono: {fmtIso(healthRes.health.checked_at)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── INTEGRACJE ── */}
      {tab === 'integrations' && (
        <div className="space-y-5">
          {client.vertical === 'rental' && (
            <IdoBookingCreds
              slug={slug}
              initial={idoCreds?.items ?? []}
              loadError={idoCreds && !idoCreds.ok ? idoCreds.message : undefined}
            />
          )}
          {healthRes && !healthRes.ok && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">{healthRes.error}</div>
          )}
          {healthRes && healthRes.ok && (
            <div className="bg-white rounded-lg border divide-y">
              {INTEGRATION_LABELS.map((it) => {
                const on = healthRes.health.integrations[it.key]
                return (
                  <div key={it.key} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className="text-sm font-medium text-slate-800">{it.label}</span>
                      <span className="text-xs text-slate-400">{on ? 'skonfigurowane' : 'brak'}</span>
                    </div>
                    {it.testable && on && <TestIntegrationButton slug={slug} integration={it.testable} />}
                  </div>
                )
              })}
            </div>
          )}
          {configForms?.allegro.hasClientId && (
            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Allegro</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aplikacja skonfigurowana (client_id).{' '}
                  {configForms.allegro.hasRefreshToken
                    ? 'Konto jest połączone.'
                    : 'Połącz konto sprzedawcy (Device Code Flow), aby dokończyć integrację.'}
                </p>
              </div>
              <AllegroConnect slug={slug} connected={configForms.allegro.hasRefreshToken} />
            </div>
          )}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-600">
              Edycja danych logowania (tokeny, klucze) odbywa się w ustawieniach aktywnego tenanta.
            </p>
            <SwitchAndSettingsLink slug={slug} />
          </div>
        </div>
      )}

      {/* ── PROMPT & SANDBOX ── */}
      {tab === 'prompt' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-5">
            <PromptExtraForm slug={slug} initial={client.promptExtra} />
          </div>
          <SandboxChat slug={slug} />
        </div>
      )}

      {/* ── UŻYTKOWNICY ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Konta przypisane do tego tenanta
            </h2>
            <Link href="/settings/users" className="text-xs text-indigo-600 hover:underline">
              Zarządzaj użytkownikami →
            </Link>
          </div>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Imię</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">E-mail</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Rola</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 text-slate-800">{u.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                    <td className="px-4 py-2.5"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{u.role}</span></td>
                    <td className="px-4 py-2.5">
                      {u.isActive
                        ? <span className="text-xs text-emerald-600">aktywny</span>
                        : <span className="text-xs text-slate-400">nieaktywny</span>}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Brak kont przypisanych do tego tenanta.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KONFIGURACJA ── */}
      {tab === 'config' && (
        <div className="space-y-5">
          {configForms && <ConfigForms slug={slug} forms={configForms} />}
          <div className="bg-white rounded-lg border p-5">
            <ConfigViewer json={client.configMaskedJson} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: 'healthy' | 'degraded' | 'inactive' }) {
  const map = {
    healthy: { label: 'Sprawny', cls: 'bg-emerald-50 text-emerald-700' },
    degraded: { label: 'Ostrzeżenia', cls: 'bg-amber-50 text-amber-700' },
    inactive: { label: 'Nieaktywny', cls: 'bg-slate-100 text-slate-500' },
  }
  const s = map[status]
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-slate-400">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-xl font-semibold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 truncate" title={sub}>{sub}</div>}
    </div>
  )
}
