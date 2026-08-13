'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, MessageCircle, Phone, Mail, ExternalLink, Check, RotateCcw, BookPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { EscalationListRow } from '@/queries/escalations'
import { ResolveDialog } from './ResolveDialog'
import { AcceptAsFaqDialog } from './AcceptAsFaqDialog'
import { reopenEscalation } from '@/actions/escalations'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { fmtDateTime } from '@/lib/datetime'

const SEVERITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  normal: 'bg-amber-100 text-amber-700 border-amber-200',
}

const LANG_FLAG: Record<string, string> = { pl: '🇵🇱', en: '🇬🇧', uk: '🇺🇦', de: '🇩🇪', ru: '🇷🇺' }

export function EscalationCard({
  escalation,
  reasonLabel,
  canEdit = true,
  vertical = 'rental',
  buildings = [],
}: {
  escalation: EscalationListRow
  reasonLabel: string
  canEdit?: boolean
  vertical?: 'rental' | 'ecommerce'
  buildings?: import('@/lib/building-format').BuildingOption[]
}) {
  const router = useRouter()
  const [resolveOpen, setResolveOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const resolved = !!escalation.resolvedAt

  const onReopen = () => startTransition(async () => {
    await reopenEscalation(escalation.id)
    router.refresh()
  })

  return (
    <div className={`rounded-lg border p-4 ${resolved ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-amber-200 bg-amber-50/30'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle className={`h-4 w-4 ${escalation.severity === 'urgent' ? 'text-red-600' : 'text-amber-600'}`} />
            <span className="font-semibold text-slate-900">{reasonLabel}</span>
            <Badge variant="outline" className={`text-[10px] uppercase ${SEVERITY_COLOR[escalation.severity] ?? ''}`}>
              {escalation.severity === 'urgent' ? 'pilne' : 'normalne'}
            </Badge>
            {escalation.escalatedTo && (
              <Badge variant="secondary" className="text-[10px]">
                → {escalation.escalatedTo === 'security' ? 'ochrona' : 'obsługa'}
              </Badge>
            )}
            {escalation.language && LANG_FLAG[escalation.language] && (
              <span className="text-sm">{LANG_FLAG[escalation.language]}</span>
            )}
          </div>

          {/* Guest info */}
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
            {escalation.guestName && <span className="font-medium text-slate-700">{escalation.guestName}</span>}
            {escalation.guestPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                <code className="font-mono">{escalation.guestPhone}</code>
              </span>
            )}
            {escalation.guestEmail && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <code className="font-mono">{escalation.guestEmail}</code>
              </span>
            )}
            {escalation.reservationId && (
              <span>rez: <code className="font-mono">{escalation.reservationId}</code></span>
            )}
          </div>

          {/* Podsumowanie sprawy — bot summary > ElevenLabs transcript_summary > fallback last user message */}
          {(escalation.summary || escalation.lastUserMessage) && (
            <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                {escalation.summary
                  ? 'Podsumowanie rozmowy'
                  : vertical === 'ecommerce' ? 'Ostatnia wiadomość klienta' : 'Ostatnia wiadomość gościa'}
              </div>
              <div className="text-sm text-slate-800">
                {escalation.summary
                  ? escalation.summary
                  : <span className="italic">„{escalation.lastUserMessage}"</span>}
              </div>
            </div>
          )}

          {/* Resolution */}
          {resolved && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Rozwiązano {fmtDateTime(escalation.resolvedAt!)}
                {escalation.resolvedBy && <span className="font-normal text-emerald-600"> · {escalation.resolvedBy}</span>}
              </div>
              {escalation.resolutionNote && (
                <div className="mt-1 text-emerald-800">{escalation.resolutionNote}</div>
              )}
              {escalation.newFaqId && (
                <Link
                  href={`/faq/${escalation.newFaqId}/edit`}
                  className="mt-1 inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 underline"
                >
                  <BookPlus className="h-3 w-3" />
                  Zaakceptowane jako FAQ
                </Link>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
            <span>
              eskalacja: {escalation.notifiedAt ? fmtDateTime(escalation.notifiedAt) : '—'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <Link
            href={escalation.conversationId ? `/conversations/${escalation.conversationId}` : '#'}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Rozmowa
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>

          {canEdit && !resolved && (
            <>
              <Button size="sm" variant="default" onClick={() => setResolveOpen(true)} className="gap-1.5 justify-start">
                <Check className="h-3.5 w-3.5" />
                Rozwiąż
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAcceptOpen(true)} className="gap-1.5 justify-start" title="Utwórz nowe FAQ z tej rozmowy">
                <BookPlus className="h-3.5 w-3.5" />
                Jako FAQ
              </Button>
            </>
          )}

          {canEdit && resolved && (
            <Button size="sm" variant="outline" onClick={onReopen} disabled={pending} className="gap-1.5 justify-start">
              <RotateCcw className="h-3.5 w-3.5" />
              Otwórz
            </Button>
          )}

          {!canEdit && (
            <span className="text-[10px] text-slate-400 px-2 py-1">tylko podgląd</span>
          )}
        </div>
      </div>

      <ResolveDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        escalationId={escalation.id}
        vertical={vertical}
      />
      <AcceptAsFaqDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        escalationId={escalation.id}
        suggestedQuestion={escalation.lastUserMessage ?? ''}
        vertical={vertical}
        buildings={buildings}
      />
    </div>
  )
}
