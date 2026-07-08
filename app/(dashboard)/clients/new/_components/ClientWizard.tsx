'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Check, X, Copy, ArrowLeft, ArrowRight, PlugZap, CheckCircle2, XCircle } from 'lucide-react'

import {
  checkSlugAvailable,
  testIntegration,
  createTenant,
  type WizardInput,
  type IntegrationTestResult,
  type CreateStep,
} from '@/actions/clients'

const HOST = 'https://etinbot.dewflow.cloud'

type Form = {
  name: string
  slug: string
  vertical: 'ecommerce' | 'rental'
  languages: string[]
  primaryLanguage: string
  officeHours: string
  botName: string
  personaDesc: string
  greeting: string
  companyLegalName: string
  companyAddress: string
  companyNip: string
  escalationPhone: string
  escalationEmail: string
  wcUrl: string
  wcConsumerKey: string
  wcConsumerSecret: string
  baselinkerToken: string
  twilioSmsNumber: string
  messengerPageId: string
  messengerPageToken: string
  emailAddress: string
  emailProvider: 'gmail' | 'imap'
  emailImapHost: string
  emailImapPort: string
  emailImapUser: string
  emailImapPass: string
  emailSmtpHost: string
  emailSmtpPort: string
  freeShippingThreshold: string
  shippingCutoff: string
  enabledChannels: string[]
}

const EMPTY: Form = {
  name: '', slug: '', vertical: 'ecommerce', languages: ['pl'], primaryLanguage: 'pl', officeHours: 'pon-pt 9-17',
  botName: '', personaDesc: '', greeting: '', companyLegalName: '', companyAddress: '', companyNip: '',
  escalationPhone: '', escalationEmail: '',
  wcUrl: '', wcConsumerKey: '', wcConsumerSecret: '', baselinkerToken: '', twilioSmsNumber: '',
  messengerPageId: '', messengerPageToken: '',
  emailAddress: '', emailProvider: 'imap', emailImapHost: '', emailImapPort: '', emailImapUser: '',
  emailImapPass: '', emailSmtpHost: '', emailSmtpPort: '',
  freeShippingThreshold: '', shippingCutoff: '',
  enabledChannels: ['webchat'],
}

const LANGS = [
  { v: 'pl', label: 'Polski' },
  { v: 'en', label: 'Angielski' },
  { v: 'uk', label: 'Ukraiński' },
  { v: 'de', label: 'Niemiecki' },
]

const CHANNELS = [
  { v: 'webchat', label: 'Webchat' },
  { v: 'email', label: 'E-mail' },
  { v: 'messenger', label: 'Messenger' },
  { v: 'sms', label: 'SMS' },
  { v: 'voice', label: 'Voice' },
  { v: 'allegro', label: 'Allegro' },
]

const STEPS = ['Podstawy', 'Brand & bot', 'Integracje', 'Kanały', 'Podsumowanie']

function slugify(s: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  }
  return s
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 text-xs bg-slate-900 text-slate-100 rounded-md px-3 py-2 overflow-x-auto whitespace-pre">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="shrink-0 h-auto px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Skopiowano' : 'Kopiuj'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 block mb-1">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400 block mt-1">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full h-9 px-3 rounded-md border border-slate-300 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none'

export function ClientWizard() {
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Form>(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugStatus, setSlugStatus] = useState<{ checking: boolean; available: boolean | null; message?: string }>({ checking: false, available: null })
  const [tests, setTests] = useState<Record<string, IntegrationTestResult & { pending?: boolean }>>({})
  const [creating, startCreate] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; slug?: string; steps?: CreateStep[]; message?: string } | null>(null)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }))

  const onNameChange = (v: string) => {
    setF((prev) => ({
      ...prev,
      name: v,
      slug: slugTouched ? prev.slug : slugify(v),
    }))
    if (!slugTouched) setSlugStatus({ checking: false, available: null })
  }

  const checkSlug = async () => {
    const s = f.slug.trim().toLowerCase()
    if (!s) return
    setSlugStatus({ checking: true, available: null })
    const r = await checkSlugAvailable(s)
    setSlugStatus({ checking: false, available: r.available, message: r.message })
  }

  const toggleArr = (k: 'languages' | 'enabledChannels', v: string) =>
    setF((prev) => {
      const has = prev[k].includes(v)
      const next = has ? prev[k].filter((x) => x !== v) : [...prev[k], v]
      return { ...prev, [k]: next }
    })

  const runTest = (integration: 'woocommerce' | 'baselinker' | 'email' | 'messenger') => {
    let params: Record<string, unknown> = {}
    if (integration === 'woocommerce') params = { wc_url: f.wcUrl, wc_consumer_key: f.wcConsumerKey, wc_consumer_secret: f.wcConsumerSecret }
    if (integration === 'baselinker') params = { baselinker_token: f.baselinkerToken }
    if (integration === 'messenger') params = { page_id: f.messengerPageId, page_token: f.messengerPageToken }
    if (integration === 'email') {
      params = { address: f.emailAddress, provider: f.emailProvider }
      if (f.emailProvider === 'imap') {
        Object.assign(params, {
          imap_host: f.emailImapHost,
          imap_port: f.emailImapPort ? Number(f.emailImapPort) : undefined,
          imap_user: f.emailImapUser || f.emailAddress,
          imap_pass: f.emailImapPass,
          smtp_host: f.emailSmtpHost || undefined,
          smtp_port: f.emailSmtpPort ? Number(f.emailSmtpPort) : undefined,
        })
      }
    }
    setTests((t) => ({ ...t, [integration]: { ok: false, pending: true } }))
    ;(async () => {
      const r = await testIntegration(integration, params)
      setTests((t) => ({ ...t, [integration]: { ...r, pending: false } }))
    })()
  }

  const submit = () => {
    startCreate(async () => {
      const payload: WizardInput = { ...f } as WizardInput
      const r = await createTenant(payload)
      if (r.ok) {
        setResult({ ok: true, slug: r.slug, steps: r.steps })
        toast.success('Tenant utworzony.')
      } else {
        setResult({ ok: false, message: r.message, steps: r.steps })
        toast.error(r.message)
      }
    })
  }

  const step1Valid = f.name.trim().length >= 2 && /^[a-z0-9-]{2,50}$/.test(f.slug.trim()) && slugStatus.available !== false && f.languages.length > 0

  // ── Ekran wynikowy ──
  if (result?.ok) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">Klient utworzony ✅</h1>
        <div className="bg-white rounded-lg border p-5 space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Wykonane kroki</h2>
          {result.steps?.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {s.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
              <div>
                <span className={s.ok ? 'text-slate-700' : 'text-red-700'}>{s.step}</span>
                {s.info && <span className="text-slate-400"> — {s.info}</span>}
                {s.error && <span className="text-red-500"> — {s.error}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-2">
          <h2 className="text-sm font-semibold text-amber-800">Działania ręczne poza platformą</h2>
          <ul className="text-sm text-amber-900 list-disc pl-5 space-y-1">
            <li>Wklej snippet webchatu i/lub paska promo na stronę klienta (kod poniżej / w kroku „Kanały”).</li>
            <li>Skonfiguruj webhook SMS w Twilio: <code className="text-xs bg-amber-100 px-1 rounded">{HOST}/webhook/twilio/sms</code></li>
            <li>Podłącz page token Messengera w Business Managerze klienta i ustaw webhook: <code className="text-xs bg-amber-100 px-1 rounded">{HOST}/webhook/messenger</code></li>
            <li>Utwórz agenta ElevenLabs + narzędzia z prefiksem <code className="text-xs bg-amber-100 px-1 rounded">{result.slug}_*</code> i wpisz agent_id w karcie klienta.</li>
            <li>Autoryzuj Allegro (OAuth device flow) po stronie backendu, jeśli klient sprzedaje na Allegro.</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Link href={`/clients/${result.slug}`} className="h-9 px-4 inline-flex items-center rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            Otwórz kartę klienta
          </Link>
          <Link href="/clients" className="h-9 px-4 inline-flex items-center rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Lista klientów
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Klienci
        </Link>
        <h1 className="text-xl font-semibold text-slate-900 mt-1">Nowy klient</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`text-xs px-2.5 py-1 rounded-full ${i === step ? 'bg-indigo-600 text-white' : i < step ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-5">
        {/* ── KROK 1: Podstawy ── */}
        {step === 0 && (
          <>
            <Field label="Nazwa firmy *">
              <input className={inputCls} value={f.name} onChange={(e) => onNameChange(e.target.value)} placeholder="np. Kraina Herbaty" />
            </Field>
            <Field label="Slug (identyfikator tenanta) *" hint="Tylko małe litery, cyfry i myślnik. Używany w URL-ach webhooków i snippetów.">
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  value={f.slug}
                  onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); setSlugStatus({ checking: false, available: null }) }}
                  onBlur={checkSlug}
                  placeholder="krainaherbaty"
                />
                <button type="button" onClick={checkSlug} className="shrink-0 h-9 px-3 rounded-md border border-slate-300 text-xs text-slate-600 hover:bg-slate-50">
                  Sprawdź
                </button>
              </div>
              {slugStatus.checking && <span className="text-xs text-slate-400 mt-1 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> sprawdzam…</span>}
              {slugStatus.available === true && <span className="text-xs text-emerald-600 mt-1 inline-flex items-center gap-1"><Check className="h-3 w-3" /> {slugStatus.message}</span>}
              {slugStatus.available === false && <span className="text-xs text-red-600 mt-1 inline-flex items-center gap-1"><X className="h-3 w-3" /> {slugStatus.message}</span>}
            </Field>
            <Field label="Typ (vertical)">
              <div className="flex gap-2">
                <button type="button" onClick={() => set('vertical', 'ecommerce')} className={`h-9 px-4 rounded-md text-sm font-medium border ${f.vertical === 'ecommerce' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 text-slate-700'}`}>
                  e-commerce
                </button>
                <button type="button" disabled className="h-9 px-4 rounded-md text-sm font-medium border border-slate-200 text-slate-300 cursor-not-allowed">
                  rental (wkrótce)
                </button>
              </div>
            </Field>
            <Field label="Języki obsługi *">
              <div className="flex flex-wrap gap-3">
                {LANGS.map((l) => (
                  <label key={l.v} className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={f.languages.includes(l.v)} onChange={() => toggleArr('languages', l.v)} className="h-4 w-4 rounded border-slate-300" />
                    {l.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Język główny">
              <select className={inputCls} value={f.primaryLanguage} onChange={(e) => set('primaryLanguage', e.target.value)}>
                {LANGS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Godziny biura" hint='Format wolny, np. "pon-pt 9-17". Wykorzystywane w kontekście czasu bota.'>
              <input className={inputCls} value={f.officeHours} onChange={(e) => set('officeHours', e.target.value)} placeholder="pon-pt 9-17" />
            </Field>
          </>
        )}

        {/* ── KROK 2: Brand & bot ── */}
        {step === 1 && (
          <>
            <Field label="Nazwa bota (persona)" hint="Imię, którym przedstawia się bot, np. „Ania”.">
              <input className={inputCls} value={f.botName} onChange={(e) => set('botName', e.target.value)} placeholder="Ania" />
            </Field>
            <Field label="Opis persony / stylu" hint="Ton, charakter, zasady komunikacji. Zostanie zapisane jako persona bota.">
              <textarea className={`${inputCls} h-auto py-2`} rows={3} value={f.personaDesc} onChange={(e) => set('personaDesc', e.target.value)} placeholder="Pomocna, konkretna, ciepła. Zna się na herbatach." />
            </Field>
            <Field label="Powitanie w webchacie" hint="Pierwsza wiadomość widgetu.">
              <textarea className={`${inputCls} h-auto py-2`} rows={2} value={f.greeting} onChange={(e) => set('greeting', e.target.value)} placeholder="Cześć! W czym mogę pomóc?" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Nazwa prawna firmy">
                <input className={inputCls} value={f.companyLegalName} onChange={(e) => set('companyLegalName', e.target.value)} placeholder="ETIN GROUP Sp. z o.o." />
              </Field>
              <Field label="Adres">
                <input className={inputCls} value={f.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} placeholder="ul. Smoluchowskiego 7, Poznań" />
              </Field>
              <Field label="NIP">
                <input className={inputCls} value={f.companyNip} onChange={(e) => set('companyNip', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Telefon eskalacyjny">
                <input className={inputCls} value={f.escalationPhone} onChange={(e) => set('escalationPhone', e.target.value)} placeholder="+48 600 000 000" />
              </Field>
              <Field label="E-mail eskalacyjny">
                <input className={inputCls} value={f.escalationEmail} onChange={(e) => set('escalationEmail', e.target.value)} placeholder="biuro@firma.pl" />
              </Field>
            </div>
          </>
        )}

        {/* ── KROK 3: Integracje ── */}
        {step === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">Wszystkie integracje są opcjonalne — możesz pominąć i uzupełnić później w ustawieniach.</p>

            <IntegrationSection title="WooCommerce" test={tests.woocommerce} onTest={() => runTest('woocommerce')} canTest={!!(f.wcUrl && f.wcConsumerKey && f.wcConsumerSecret)}>
              <Field label="Adres sklepu (URL)"><input className={inputCls} value={f.wcUrl} onChange={(e) => set('wcUrl', e.target.value)} placeholder="https://sklep.pl" /></Field>
              <Field label="Consumer key"><input className={inputCls} value={f.wcConsumerKey} onChange={(e) => set('wcConsumerKey', e.target.value)} placeholder="ck_..." /></Field>
              <Field label="Consumer secret"><input className={inputCls} type="password" value={f.wcConsumerSecret} onChange={(e) => set('wcConsumerSecret', e.target.value)} placeholder="cs_..." /></Field>
            </IntegrationSection>

            <IntegrationSection title="BaseLinker" test={tests.baselinker} onTest={() => runTest('baselinker')} canTest={!!f.baselinkerToken}>
              <Field label="Token API"><input className={inputCls} type="password" value={f.baselinkerToken} onChange={(e) => set('baselinkerToken', e.target.value)} /></Field>
            </IntegrationSection>

            <IntegrationSection title="Skrzynka e-mail" test={tests.email} onTest={() => runTest('email')} canTest={!!f.emailAddress}>
              <Field label="Adres e-mail"><input className={inputCls} value={f.emailAddress} onChange={(e) => set('emailAddress', e.target.value)} placeholder="sklep@firma.pl" /></Field>
              <Field label="Provider">
                <select className={inputCls} value={f.emailProvider} onChange={(e) => set('emailProvider', e.target.value as 'gmail' | 'imap')}>
                  <option value="imap">IMAP/SMTP</option>
                  <option value="gmail">Gmail (service account)</option>
                </select>
              </Field>
              {f.emailProvider === 'imap' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="IMAP host"><input className={inputCls} value={f.emailImapHost} onChange={(e) => set('emailImapHost', e.target.value)} placeholder="imap.firma.pl" /></Field>
                  <Field label="IMAP port"><input className={inputCls} value={f.emailImapPort} onChange={(e) => set('emailImapPort', e.target.value)} placeholder="993" /></Field>
                  <Field label="IMAP użytkownik"><input className={inputCls} value={f.emailImapUser} onChange={(e) => set('emailImapUser', e.target.value)} placeholder="(domyślnie = adres)" /></Field>
                  <Field label="IMAP hasło"><input className={inputCls} type="password" value={f.emailImapPass} onChange={(e) => set('emailImapPass', e.target.value)} /></Field>
                  <Field label="SMTP host"><input className={inputCls} value={f.emailSmtpHost} onChange={(e) => set('emailSmtpHost', e.target.value)} placeholder="smtp.firma.pl" /></Field>
                  <Field label="SMTP port"><input className={inputCls} value={f.emailSmtpPort} onChange={(e) => set('emailSmtpPort', e.target.value)} placeholder="587" /></Field>
                </div>
              )}
            </IntegrationSection>

            <IntegrationSection title="Messenger" test={tests.messenger} onTest={() => runTest('messenger')} canTest={!!(f.messengerPageId && f.messengerPageToken)}>
              <Field label="Page ID"><input className={inputCls} value={f.messengerPageId} onChange={(e) => set('messengerPageId', e.target.value)} /></Field>
              <Field label="Page token"><input className={inputCls} type="password" value={f.messengerPageToken} onChange={(e) => set('messengerPageToken', e.target.value)} /></Field>
            </IntegrationSection>

            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Twilio SMS i dostawa</h3>
              <Field label="Numer Twilio (SMS)"><input className={inputCls} value={f.twilioSmsNumber} onChange={(e) => set('twilioSmsNumber', e.target.value)} placeholder="+48..." /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Próg darmowej dostawy (PLN)"><input className={inputCls} value={f.freeShippingThreshold} onChange={(e) => set('freeShippingThreshold', e.target.value)} placeholder="99" /></Field>
                <Field label="Cutoff wysyłki"><input className={inputCls} value={f.shippingCutoff} onChange={(e) => set('shippingCutoff', e.target.value)} placeholder="do 12:00 = dziś" /></Field>
              </div>
            </div>
          </div>
        )}

        {/* ── KROK 4: Kanały ── */}
        {step === 3 && (
          <>
            <Field label="Włączone kanały">
              <div className="flex flex-wrap gap-3">
                {CHANNELS.map((c) => (
                  <label key={c.v} className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={f.enabledChannels.includes(c.v)} onChange={() => toggleArr('enabledChannels', c.v)} className="h-4 w-4 rounded border-slate-300" />
                    {c.label}
                  </label>
                ))}
              </div>
            </Field>

            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-slate-700">Snippety do wklejenia na stronę klienta</h3>
              <CopyBox label="Webchat (widget)" value={`<script src="${HOST}/api/webchat/widget.js" data-site="${f.slug || 'slug'}" defer></script>`} />
              <CopyBox label="Pasek promo (promobar)" value={`<script src="${HOST}/api/promobar/widget.js" data-site="${f.slug || 'slug'}" defer></script>`} />
              <h3 className="text-sm font-semibold text-slate-700 pt-2">Webhooki</h3>
              <CopyBox label="Twilio SMS" value={`${HOST}/webhook/twilio/sms`} />
              <CopyBox label="Messenger" value={`${HOST}/webhook/messenger`} />
            </div>
          </>
        )}

        {/* ── KROK 5: Podsumowanie ── */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Podsumowanie</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row k="Nazwa" v={f.name} />
              <Row k="Slug" v={f.slug} />
              <Row k="Typ" v={f.vertical} />
              <Row k="Języki" v={f.languages.join(', ')} />
              <Row k="Język główny" v={f.primaryLanguage} />
              <Row k="Godziny biura" v={f.officeHours} />
              <Row k="Bot" v={f.botName || '—'} />
              <Row k="Eskalacja tel." v={f.escalationPhone || '—'} />
              <Row k="Eskalacja e-mail" v={f.escalationEmail || '—'} />
              <Row k="Kanały" v={f.enabledChannels.join(', ') || '—'} />
              <Row k="WooCommerce" v={f.wcUrl ? '✓ podane' : '—'} />
              <Row k="BaseLinker" v={f.baselinkerToken ? '✓ podane' : '—'} />
              <Row k="Skrzynka" v={f.emailAddress || '—'} />
              <Row k="Messenger" v={f.messengerPageId ? '✓ podane' : '—'} />
            </dl>
            {result && !result.ok && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                {result.message}
                {result.steps && result.steps.length > 0 && (
                  <ul className="mt-2 list-disc pl-5">
                    {result.steps.map((s, i) => (
                      <li key={i} className={s.ok ? 'text-slate-600' : 'text-red-700'}>{s.step}{s.error ? ` — ${s.error}` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p className="text-xs text-slate-400">
              Utworzenie: init-tenant → zapis integracji (sekrety szyfrowane) → skrzynka → sync produktów/zamówień. Nieudany pojedynczy krok nie przerywa reszty.
            </p>
          </div>
        )}
      </div>

      {/* Nawigacja */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0 || creating}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Wstecz
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={step === 0 && !step1Valid}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
          >
            Dalej <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={creating || !step1Valid}
            onClick={submit}
            className="h-9 px-5 inline-flex items-center gap-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {creating ? 'Tworzę…' : 'Utwórz klienta'}
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-slate-800 font-medium text-right">{v}</dd>
    </div>
  )
}

function IntegrationSection({
  title, children, onTest, canTest, test,
}: {
  title: string
  children: React.ReactNode
  onTest: () => void
  canTest: boolean
  test?: IntegrationTestResult & { pending?: boolean }
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <button
          type="button"
          onClick={onTest}
          disabled={!canTest || test?.pending}
          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {test?.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
          Testuj połączenie
        </button>
      </div>
      {children}
      {test && !test.pending && (
        <div className={`text-xs rounded-md px-3 py-2 ${test.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {test.ok ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {test.detail || 'Połączono.'}</span> : <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> {test.error || 'Błąd połączenia.'}</span>}
        </div>
      )}
    </div>
  )
}
