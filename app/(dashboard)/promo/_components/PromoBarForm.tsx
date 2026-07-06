'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { createPromoBar, updatePromoBar, type PromoActionResult } from '@/actions/promobar'

export type PromoBarValues = {
  id?: string
  name: string
  text: string
  cta_text: string
  cta_url: string
  coupon_code: string
  timer_ends_at: string // datetime-local
  timer_finished_text: string
  hide_after_end: boolean
  starts_at: string
  ends_at: string
  include_paths: string
  exclude_paths: string
  priority: number
  colors: Record<string, string>
  sizes: Record<string, number>
  text_b: string
  free_shipping_threshold: string
  text_reached: string
}

const DEFAULT_SIZES: Record<string, number> = { text: 15, cta: 13, timer_digits: 14, timer_labels: 10 }

const DEFAULT_COLORS: Record<string, string> = {
  bg: '#2e7d32', text: '#ffffff', cta_bg: '#ffffff',
  cta_text: '#2e7d32', timer_bg: '#ffffff', timer_text: '#2e7d32',
}

function Color({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 rounded border border-slate-200 cursor-pointer p-0.5 bg-white" />
        <input name={name} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-24 px-2 rounded border border-slate-200 text-xs font-mono" />
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

const INPUT = 'w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-200'

export function PromoBarForm({ initial }: { initial?: PromoBarValues }) {
  const router = useRouter()
  const isEdit = Boolean(initial?.id)
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_COLORS, ...(initial?.colors ?? {}) })
  const [sizes, setSizes] = useState<Record<string, number>>({ ...DEFAULT_SIZES, ...(initial?.sizes ?? {}) })
  const [text, setText] = useState(initial?.text ?? '')
  const [ctaText, setCtaText] = useState(initial?.cta_text ?? '')
  const [timer, setTimer] = useState(initial?.timer_ends_at ?? '')

  const action = async (_prev: PromoActionResult, fd: FormData): Promise<PromoActionResult> => {
    const res = initial?.id ? await updatePromoBar(initial.id, _prev, fd) : await createPromoBar(_prev, fd)
    if (res.ok) {
      toast.success(res.message)
      router.push('/promo')
    } else {
      toast.error(res.message)
    }
    return res
  }
  const [, formAction, pending] = useActionState(action, { ok: false, message: '' })

  const setColor = (k: string) => (v: string) => setColors((c) => ({ ...c, [k]: v }))

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      {/* Podgląd na żywo */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-3 py-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 border-b">Podgląd</div>
        <div
          className="w-full flex items-center justify-center gap-4 flex-wrap px-10 py-2.5 relative"
          style={{ background: colors.bg, color: colors.text, fontSize: `${sizes.text}px` }}
        >
          <span className="font-semibold">{text || 'Treść paska promocyjnego…'}</span>
          {timer && (
            <span className="inline-flex gap-1.5">
              {[['03', 'Godzin'], ['18', 'Minut'], ['36', 'Sekund']].map(([n, l]) => (
                <span key={l} className="inline-flex flex-col items-center gap-0.5">
                  <span className="rounded px-1.5 py-0.5 font-bold min-w-[30px] text-center" style={{ background: colors.timer_bg, color: colors.timer_text, fontSize: `${sizes.timer_digits}px` }}>{n}</span>
                  <span className="opacity-90" style={{ fontSize: `${sizes.timer_labels}px` }}>{l}</span>
                </span>
              ))}
            </span>
          )}
          {ctaText && (
            <span className="rounded-md px-3.5 py-1.5 font-bold" style={{ background: colors.cta_bg, color: colors.cta_text, fontSize: `${sizes.cta}px` }}>
              {ctaText}
            </span>
          )}
          <span className="absolute right-3 opacity-70 text-xl leading-none">×</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Treść</h2>
        <Field label="Nazwa kampanii (wewnętrzna)">
          <input name="name" defaultValue={initial?.name ?? ''} required className={INPUT} placeholder="np. Dzień Herbaty -15%" />
        </Field>
        <Field label="Tekst paska">
          <input name="text" value={text} onChange={(e) => setText(e.target.value)} required className={INPUT} placeholder="Wiosenny rabat -15% z kodem WIOSNA15 jeszcze przez:" />
        </Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Tekst przycisku (puste = bez przycisku)">
            <input name="cta_text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} className={INPUT} placeholder="Pokaż szczegóły!" />
          </Field>
          <Field label="Link przycisku">
            <input name="cta_url" type="url" defaultValue={initial?.cta_url ?? ''} className={INPUT} placeholder="https://krainaherbaty.pl/promocja/" />
          </Field>
        </div>
        <Field label="Kod rabatowy (opcjonalnie)" hint="Klik w przycisk skopiuje kod do schowka klienta (obok przejścia w link).">
          <input name="coupon_code" defaultValue={initial?.coupon_code ?? ''} className={INPUT} placeholder="WIOSNA15" />
        </Field>
        <Field label="Wariant B treści — test A/B (opcjonalnie)" hint="Połowa odwiedzających zobaczy wariant B; porównasz CTR obu na liście kampanii.">
          <input name="text_b" defaultValue={initial?.text_b ?? ''} className={INPUT} placeholder="Alternatywna treść paska…" />
        </Field>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Darmowa dostawa (dynamiczny pasek, opcjonalnie)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Próg darmowej dostawy (zł)" hint={'W treści użyj {missing} i {prog}, np. "Do darmowej dostawy brakuje Ci {missing}!" — kwota liczona z koszyka klienta na żywo.'}>
            <input name="free_shipping_threshold" defaultValue={initial?.free_shipping_threshold ?? ''} className={INPUT} placeholder="99" />
          </Field>
          <Field label="Tekst po osiągnięciu progu">
            <input name="text_reached" defaultValue={initial?.text_reached ?? ''} className={INPUT} placeholder="Masz darmową dostawę! 🎉" />
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Zegar (opcjonalny)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Odliczanie do (puste = pasek bez zegara)">
            <input name="timer_ends_at" type="datetime-local" value={timer} onChange={(e) => setTimer(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Tekst po zakończeniu odliczania">
            <input name="timer_finished_text" defaultValue={initial?.timer_finished_text ?? ''} className={INPUT} placeholder="Promocja zakończona — do zobaczenia następnym razem!" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="hide_after_end" defaultChecked={initial ? initial.hide_after_end : true} className="h-4 w-4" />
          Ukryj pasek po zakończeniu odliczania (odznacz, żeby pokazać „tekst po zakończeniu")
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Kolory</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Color name="color_bg" label="Tło paska" value={colors.bg} onChange={setColor('bg')} />
          <Color name="color_text" label="Tekst" value={colors.text} onChange={setColor('text')} />
          <Color name="color_cta_bg" label="Tło przycisku" value={colors.cta_bg} onChange={setColor('cta_bg')} />
          <Color name="color_cta_text" label="Tekst przycisku" value={colors.cta_text} onChange={setColor('cta_text')} />
          <Color name="color_timer_bg" label="Kafelki zegara" value={colors.timer_bg} onChange={setColor('timer_bg')} />
          <Color name="color_timer_text" label="Cyfry zegara" value={colors.timer_text} onChange={setColor('timer_text')} />
        </div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Rozmiary czcionek (px)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([['size_text', 'Tekst paska', 'text'], ['size_cta', 'Przycisk', 'cta'], ['size_timer_digits', 'Cyfry zegara', 'timer_digits'], ['size_timer_labels', 'Etykiety zegara', 'timer_labels']] as const).map(([name, label, key]) => (
            <Field key={name} label={label}>
              <input
                name={name}
                type="number"
                min={8}
                max={40}
                value={sizes[key]}
                onChange={(e) => setSizes((sz) => ({ ...sz, [key]: parseInt(e.target.value, 10) || DEFAULT_SIZES[key] }))}
                className={INPUT}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Wyświetlanie</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Pokazuj od (harmonogram, puste = od razu)">
            <input name="starts_at" type="datetime-local" defaultValue={initial?.starts_at ?? ''} className={INPUT} />
          </Field>
          <Field label="Pokazuj do (puste = bezterminowo)">
            <input name="ends_at" type="datetime-local" defaultValue={initial?.ends_at ?? ''} className={INPUT} />
          </Field>
        </div>
        <Field label="Tylko na stronach (prefiksy po przecinku; puste = wszystkie)" hint={'np. "/" = tylko strona główna; "/bomby-herbaciane" = kategoria.'}>
          <input name="include_paths" defaultValue={initial?.include_paths ?? ''} className={INPUT} placeholder="" />
        </Field>
        <Field label="Nie pokazuj na stronach" hint="Domyślnie strony transakcyjne — koszyk i zamówienie.">
          <input name="exclude_paths" defaultValue={initial?.exclude_paths ?? '/koszyk, /zamowienie, /cart, /checkout'} className={INPUT} />
        </Field>
        <Field label="Priorytet" hint="Gdy kilka kampanii aktywnych naraz, wygrywa wyższy priorytet.">
          <input name="priority" type="number" min={0} max={1000} defaultValue={initial?.priority ?? 0} className={`${INPUT} w-28`} />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="h-10 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Zapisz zmiany' : 'Utwórz kampanię'}
        </button>
      </div>
    </form>
  )
}
