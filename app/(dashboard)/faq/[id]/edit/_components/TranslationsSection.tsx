'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, RefreshCw, Pencil, AlertCircle, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { regenerateTranslation } from '@/actions/faq'
import type { TranslationRow } from '@/queries/faq'
import { EditTranslationModal } from './EditTranslationModal'

const LANG_NAMES: Record<string, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  uk: { label: 'Українська', flag: '🇺🇦' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
}

type Props = {
  parentId: string
  masterUpdatedAt: Date
  translations: TranslationRow[]
}

export function TranslationsSection({ parentId, masterUpdatedAt, translations }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-900">Tłumaczenia</h2>
        <span className="text-xs text-slate-500 ml-auto">
          Generowane automatycznie z polskiego mastera. Możesz nadpisać ręcznie.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['en', 'uk', 'de'] as const).map((lang) => {
          const tr = translations.find((t) => t.language === lang)
          return (
            <TranslationCard
              key={lang}
              parentId={parentId}
              language={lang}
              translation={tr}
              masterUpdatedAt={masterUpdatedAt}
            />
          )
        })}
      </div>
    </div>
  )
}

function TranslationCard({
  parentId,
  language,
  translation,
  masterUpdatedAt,
}: {
  parentId: string
  language: 'en' | 'uk' | 'de'
  translation: TranslationRow | undefined
  masterUpdatedAt: Date
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const meta = LANG_NAMES[language]

  if (!translation) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.flag}</span>
          <span className="font-medium text-slate-900">{meta.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Brak tłumaczenia</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(async () => {
            await regenerateTranslation(parentId, language)
            router.refresh()
          })}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          Wygeneruj
        </Button>
      </div>
    )
  }

  const stale = translation.autoTranslatedAt && translation.autoTranslatedAt < masterUpdatedAt
    && !translation.manuallyEdited

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.flag}</span>
            <span className="font-medium text-slate-900">{meta.label}</span>
          </div>
          {translation.manuallyEdited ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium uppercase">
              ręczne
            </span>
          ) : stale ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium uppercase">
              nieaktualne
            </span>
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
        </div>

        <div className="space-y-1.5 flex-1">
          <div className="text-xs font-medium text-slate-500 uppercase">Pytanie</div>
          <div className="text-sm text-slate-900 line-clamp-2">{translation.question}</div>

          <div className="text-xs font-medium text-slate-500 uppercase mt-2">Odpowiedź</div>
          <div className="text-xs text-slate-700 line-clamp-3">{translation.answer}</div>

          {translation.answerVoice && (
            <>
              <div className="text-xs font-medium text-slate-500 uppercase mt-2">Voice</div>
              <div className="text-xs text-slate-500 italic line-clamp-2">{translation.answerVoice}</div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
          <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} disabled={pending} className="text-xs">
            <Pencil className="h-3 w-3" />
            Edytuj
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(async () => {
              await regenerateTranslation(parentId, language)
              router.refresh()
            })}
            className="text-xs"
            title={translation.manuallyEdited ? 'Wymuszone — nadpisze ręczną edycję' : undefined}
          >
            <RefreshCw className={`h-3 w-3 ${pending ? 'animate-spin' : ''}`} />
            Regeneruj
          </Button>
          {translation.autoTranslatedAt && (
            <span className="text-[10px] text-slate-400 ml-auto">
              {translation.autoTranslatedAt.toLocaleDateString('pl-PL')}
            </span>
          )}
        </div>
      </div>

      <EditTranslationModal
        open={editOpen}
        onOpenChange={setEditOpen}
        translation={translation}
        langLabel={meta.label}
      />
    </>
  )
}
