import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  User,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Package,
} from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { requireModule } from '@/lib/modules-server'
import { fmtFullDateTime, fmtDateTime } from '@/lib/datetime'
import { channelLabel, fmtMarginPct, fmtZl, statusMeta } from '@/lib/quotes'
import { getQuote, listCostItems } from '@/queries/quotes'
import { getMailboxes } from '@/queries/email'
import { activeClientSlug } from '@/lib/tenant'
import { QuoteActions } from './_components/QuoteActions'
import { LinesEditor } from './_components/LinesEditor'

export default async function WycenaPage(props: { params: Promise<{ id: string }> }) {
  await requireAuth()
  await requireModule('quotes')
  const { id } = await props.params

  const detail = await getQuote(id)
  if (!detail) notFound()
  const { quote, lines, conversation } = detail

  const [{ items: costItems }, mailboxes] = await Promise.all([
    listCostItems(),
    activeClientSlug().then((slug) => getMailboxes(slug)),
  ])

  const st = statusMeta(quote.status)
  const qty = quote.quantity ?? quote.spec.quantity

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/wyceny" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Wróć do wycen
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">{quote.spec.product ?? 'Wycena'}</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 flex-wrap">
            <span>{fmtFullDateTime(new Date(quote.createdAt))}</span>
            <span>Kanał: {channelLabel(quote.sourceChannel)}</span>
            {qty != null && <span>{qty} szt</span>}
            {quote.approvedBy && <span>Zatwierdził(a): {quote.approvedBy}</span>}
            {quote.sentAt && <span>Wysłano: {fmtFullDateTime(new Date(quote.sentAt))}</span>}
          </div>
        </div>
        <QuoteActions
          id={quote.id}
          status={quote.status}
          customerEmail={quote.customerEmail}
          mailboxes={mailboxes.map((m) => m.address)}
        />
      </header>

      {quote.status === 'analyzing' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
          Analiza w toku — wynik za ok. 10–30 s, odśwież stronę za chwilę.
        </div>
      )}

      {/* Podsumowanie kalkulacji */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Koszt łączny" value={fmtZl(quote.costTotal)} />
        <SummaryCard label="Cena za szt." value={fmtZl(quote.pricePerUnit)} />
        <SummaryCard label="Wartość wyceny" value={fmtZl(quote.priceTotal)} accent />
        <SummaryCard label="Marża" value={fmtMarginPct(quote.marginPct)} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Główna kolumna */}
        <div className="space-y-5 min-w-0">
          {/* Analiza LLM */}
          <section className="bg-white rounded-lg border p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-slate-500" /> Analiza
            </h2>
            {quote.status === 'failed' && quote.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap break-words">{quote.error}</span>
              </div>
            )}
            {quote.analysis ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{quote.analysis}</p>
            ) : (
              <p className="text-sm text-slate-400">
                Brak analizy{quote.status === 'analyzing' ? ' — w toku.' : ' — uruchom „Analizuj ponownie".'}
              </p>
            )}
          </section>

          {/* Kalkulacja — edytowalna tabela pozycji */}
          <LinesEditor
            quoteId={quote.id}
            initialLines={lines}
            initialQuantity={qty}
            initialTargetMarginPct={quote.targetMarginPct}
            costItems={costItems}
          />

          {/* Kontekst rozmowy */}
          {conversation.length > 0 && (
            <details className="bg-white rounded-lg border group">
              <summary className="cursor-pointer select-none p-4 text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5 w-full">
                <MessageCircle className="h-4 w-4 text-slate-500" />
                Kontekst rozmowy ({conversation.length})
                <span className="ml-auto text-xs font-normal text-slate-400 group-open:hidden">rozwiń</span>
              </summary>
              <div className="px-4 pb-4 space-y-2 max-h-96 overflow-y-auto">
                {conversation.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 text-sm ${
                      m.role === 'user'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400 mb-1">
                      {m.role === 'user' ? 'Klient' : 'Bot'}
                      {m.createdAt ? ` · ${fmtDateTime(new Date(m.createdAt))}` : ''}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Boczna kolumna — zapytanie klienta */}
        <aside className="space-y-4">
          <section className="bg-white rounded-lg border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
              <Package className="h-4 w-4 text-slate-500" /> Zapytanie klienta
            </h2>
            <dl className="space-y-2 text-sm">
              <SpecRow label="Produkt" value={quote.spec.product} />
              <SpecRow label="Ilość" value={quote.spec.quantity != null ? `${quote.spec.quantity} szt` : null} />
              <SpecRow label="Personalizacja" value={quote.spec.personalization} />
              <SpecRow label="Termin" value={quote.spec.deadline} />
              <SpecRow label="Uwagi" value={quote.spec.notes} />
            </dl>
          </section>

          <section className="bg-white rounded-lg border p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-500" /> Dane kontaktowe
            </h2>
            <dl className="space-y-2 text-sm">
              <SpecRow label="Imię i nazwisko" value={quote.customerName} />
              <SpecRow label="Firma" value={quote.customerCompany} />
              <SpecRow label="E-mail" value={quote.customerEmail} />
              <SpecRow label="Telefon" value={quote.customerPhone} />
            </dl>
            {quote.conversationId && (
              <Link
                href={`/conversations/${quote.conversationId}`}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline mt-1"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Zobacz rozmowę z botem
              </Link>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${accent ? 'text-indigo-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-slate-800 whitespace-pre-wrap break-words">{value ?? '—'}</dd>
    </div>
  )
}
