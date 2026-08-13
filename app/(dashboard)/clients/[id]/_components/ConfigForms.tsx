'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

import {
  updateEscalation,
  updatePayment,
  updateCompany,
  updateShipping,
  updateWebchat,
  updateFeatures,
  updateAutonomy,
} from '@/actions/client-config'
import type { ClientConfigForms } from '@/queries/clients'

type Field = {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'color' | 'select'
  placeholder?: string
  hint?: string
  full?: boolean
  options?: { value: string; label: string }[]
}

function Section({
  title,
  description,
  fields,
  initial,
  onSave,
}: {
  title: string
  description?: string
  fields: Field[]
  initial: Record<string, string>
  onSave: (fd: FormData) => Promise<{ ok: boolean; message: string }>
}) {
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await onSave(fd)
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
    })
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}>
            <label className="text-xs font-medium text-slate-600 block mb-1">{f.label}</label>
            {f.type === 'color' ? (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  name={f.name}
                  defaultValue={initial[f.name] || '#4f46e5'}
                  className="h-9 w-14 rounded-md border border-slate-300 bg-white p-1 cursor-pointer"
                />
                <span className="text-xs text-slate-400">{initial[f.name] || 'domyślny'}</span>
              </div>
            ) : f.type === 'select' ? (
              <select
                name={f.name}
                defaultValue={initial[f.name] ?? f.options?.[0]?.value ?? ''}
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white"
              >
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type ?? 'text'}
                name={f.name}
                defaultValue={initial[f.name] ?? ''}
                placeholder={f.placeholder}
                step={f.type === 'number' ? 'any' : undefined}
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            )}
            {f.hint && <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>}
          </div>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Zapisz
      </button>
    </form>
  )
}

function FeaturesSection({
  slug,
  initial,
}: {
  slug: string
  initial: { ordering: boolean; order_lookup: boolean }
}) {
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await updateFeatures(slug, fd)
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
    })
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Funkcje bota</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Zakres działań bota w rozmowie. Wyłączenie ogranicza dostępne narzędzia (config.features).
        </p>
      </div>
      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="ordering"
            defaultChecked={initial.ordering}
            className="h-4 w-4 mt-0.5 rounded border-slate-300"
          />
          <span>
            <span className="font-medium">Składanie zamówień przez bota</span>
            <span className="block text-xs text-slate-500">
              Bot może utworzyć zamówienie w trakcie rozmowy. Wyłączone = tylko doradztwo produktowe.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="order_lookup"
            defaultChecked={initial.order_lookup}
            className="h-4 w-4 mt-0.5 rounded border-slate-300"
          />
          <span>
            <span className="font-medium">Sprawdzanie statusu zamówień i przesyłek</span>
            <span className="block text-xs text-slate-500">
              Bot sprawdza status zamówienia i śledzenie przesyłki. Wymaga dostępu do sklepu.
            </span>
          </span>
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Zapisz
      </button>
    </form>
  )
}

function AutonomySection({
  slug,
  initial,
}: {
  slug: string
  initial: ClientConfigForms['autonomy']
}) {
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await updateAutonomy(slug, fd)
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
    })
  }

  const numFields = [
    {
      name: 'reship_max_qty' as const,
      label: 'Maks. sztuk na zgłoszenie',
      placeholder: '4',
      hint: 'Powyżej progu — eskalacja do człowieka.',
    },
    {
      name: 'reship_window_days' as const,
      label: 'Okno anty-nadużyciowe (dni)',
      placeholder: '30',
      hint: 'Okres liczenia zgłoszeń od tego samego klienta.',
    },
    {
      name: 'reship_max_in_window' as const,
      label: 'Maks. dosyłek w oknie',
      placeholder: '1',
      hint: 'Kolejne zgłoszenie w oknie — eskalacja.',
    },
  ]

  return (
    <form onSubmit={submit} className="bg-white rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Autonomia dosyłek</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Automatyczne zlecanie dosyłek uszkodzonych/brakujących produktów — zmiana statusu
          zamówienia + zlecenie do magazynu (config.integrations.autonomy).
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="reship_enabled"
          defaultChecked={initial.reship_enabled}
          className="h-4 w-4 mt-0.5 rounded border-slate-300"
        />
        <span>
          <span className="font-medium">Automatyczne dosyłki włączone</span>
          <span className="block text-xs text-slate-500">
            Wyłączone = bot zawsze eskaluje reklamacje uszkodzeń do człowieka.
          </span>
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {numFields.map((f) => (
          <div key={f.name}>
            <label className="text-xs font-medium text-slate-600 block mb-1">{f.label}</label>
            <input
              type="number"
              name={f.name}
              min={1}
              step={1}
              defaultValue={initial[f.name]}
              placeholder={f.placeholder}
              className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
            <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">
          Słowa generyczne asortymentu (oddziel przecinkami)
        </label>
        <textarea
          name="reship_generic_tokens"
          defaultValue={initial.reship_generic_tokens}
          rows={2}
          placeholder="np. bomba, bomby, herbaciana, herbaciane"
          className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Słowa z nazw produktów tego sklepu zbyt ogólne, by wskazywały konkretną pozycję (rodzaj
          asortymentu, odmiany). Guard dosyłek pomija je przy dopasowywaniu reklamowanej pozycji do
          zawartości zamówienia — bez nich każda nazwa z takim słowem pasowałaby do wszystkiego.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Zapisz
      </button>
    </form>
  )
}

export function ConfigForms({ slug, forms }: { slug: string; forms: ClientConfigForms }) {
  // bind slug do każdej akcji
  const bind =
    (action: (slug: string, fd: FormData) => Promise<{ ok: boolean; message: string }>) =>
    (fd: FormData) =>
      action(slug, fd)

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Edycja kluczowych sekcji configu. Puste pole = usunięcie danej wartości. Pozostałe pola
        sekcji (spoza formularza) są zachowywane przy zapisie.
      </p>

      <FeaturesSection slug={slug} initial={forms.features} />

      <AutonomySection slug={slug} initial={forms.autonomy} />

      <Section
        title="Eskalacja"
        description="Kontakt awaryjny — telefon i e-mail do przekierowania trudnych spraw."
        initial={forms.escalation as unknown as Record<string, string>}
        onSave={bind(updateEscalation)}
        fields={[
          { name: 'phone', label: 'Telefon', type: 'tel', placeholder: '+48 600 100 200' },
          { name: 'email', label: 'E-mail', type: 'email', placeholder: 'kontakt@firma.pl' },
          {
            name: 'voice_mode',
            label: 'Reakcja na eskalację (voice)',
            type: 'select',
            full: true,
            options: [
              {
                value: 'callback',
                label: 'Oddzwonienie — obsługa kontaktuje się niezwłocznie (SMS pilny do obsługi)',
              },
              {
                value: 'transfer',
                label: 'Przełączenie połączenia — wymaga narzędzia Transfer to number w ElevenLabs',
              },
            ],
            hint: 'Callback: bot mówi że obsługa oddzwoni niezwłocznie w godzinach pracy biura, a Ty dostajesz SMS „skontaktuj się TERAZ”. Transfer: bot przełącza rozmowę — skonfiguruj transfer w agencie ElevenLabs (checklista w Prompt & sandbox).',
          },
        ]}
      />

      <Section
        title="Płatności"
        description="Dane przelewu recytowane przez bota / w mailu potwierdzenia zamówienia."
        initial={forms.payment as unknown as Record<string, string>}
        onSave={bind(updatePayment)}
        fields={[
          { name: 'recipient', label: 'Odbiorca', placeholder: 'np. Twoja Firma Sp. z o.o.' },
          { name: 'account', label: 'Numer konta', placeholder: 'PL00 0000 0000 0000 0000 0000 0000' },
          {
            name: 'title_prefix',
            label: 'Prefiks tytułu przelewu',
            placeholder: 'Zamówienie',
            full: true,
            hint: 'Doklejany przed numerem zamówienia w tytule przelewu.',
          },
        ]}
      />

      <Section
        title="Dostawa"
        description="Parametry wysyłki używane przez bota (config.integrations.shipping)."
        initial={forms.shipping as unknown as Record<string, string>}
        onSave={bind(updateShipping)}
        fields={[
          {
            name: 'free_shipping_threshold',
            label: 'Próg darmowej dostawy (PLN)',
            type: 'number',
            placeholder: '200',
          },
          {
            name: 'cutoff_hour',
            label: 'Godzina cutoff (0–23)',
            type: 'number',
            placeholder: '15',
            hint: 'Do której godziny zamówienie wyjdzie tego samego dnia.',
          },
        ]}
      />

      <Section
        title="Webchat"
        description="Branding widgetu czatu (config.integrations.webchat)."
        initial={forms.webchat as unknown as Record<string, string>}
        onSave={bind(updateWebchat)}
        fields={[
          { name: 'name', label: 'Nazwa bota', placeholder: 'Ania' },
          { name: 'color', label: 'Kolor akcentu', type: 'color' },
          {
            name: 'greeting',
            label: 'Powitanie',
            placeholder: 'Cześć! W czym mogę pomóc?',
            full: true,
          },
        ]}
      />

      <Section
        title="Dane firmy"
        description="Dane rejestrowe (config.company)."
        initial={forms.company as unknown as Record<string, string>}
        onSave={bind(updateCompany)}
        fields={[
          { name: 'legal_name', label: 'Nazwa prawna', placeholder: 'np. Twoja Firma Sp. z o.o.', full: true },
          { name: 'address', label: 'Adres', placeholder: 'ul. Przykładowa 1, 00-000 Miasto', full: true },
          { name: 'nip', label: 'NIP', placeholder: '0000000000' },
        ]}
      />
    </div>
  )
}
