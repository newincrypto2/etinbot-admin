'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, GraduationCap, MessageSquare, User } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { approveCandidate, rejectCandidate } from '@/actions/email'
import type { FaqCandidate } from '@/queries/email'

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  edited_draft: { label: 'Edytowano draft bota', color: 'bg-amber-100 text-amber-800' },
  human_quick: { label: 'Quick-reply (bot nie pisał)', color: 'bg-violet-100 text-violet-700' },
  escalated: { label: 'Bot nie był pewien', color: 'bg-red-100 text-red-700' },
}

export function CandidateCard({ c, canEdit = true }: { c: FaqCandidate; canEdit?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [question, setQuestion] = useState(c.suggestedQuestion ?? '')
  const [answer, setAnswer] = useState(c.suggestedAnswer ?? '')
  const [category, setCategory] = useState(c.suggestedCategory ?? '')

  const src = SOURCE_LABEL[c.source] ?? { label: c.source, color: 'bg-slate-100 text-slate-600' }

  const onApprove = () =>
    startTransition(async () => {
      const r = await approveCandidate(c.id, { question, answer, category })
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
      router.refresh()
    })
  const onReject = () =>
    startTransition(async () => {
      const r = await rejectCandidate(c.id)
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
      router.refresh()
    })

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${src.color}`}>{src.label}</span>
        {!c.distilled && <span className="text-[11px] text-slate-400">analiza w toku…</span>}
        {c.skipReason && (
          <span className="text-[11px] text-slate-400" title={c.skipReason}>
            LLM: jednorazowy przypadek
          </span>
        )}
      </div>

      {/* Kontekst — co się wydarzyło */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
          <div className="text-[11px] font-semibold text-blue-700 mb-1 inline-flex items-center gap-1">
            <User className="h-3 w-3" /> Pytanie klienta
          </div>
          <div className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-6">{c.customerQuestion ?? '—'}</div>
        </div>
        <div className="rounded-md bg-emerald-50 border border-emerald-100 p-3">
          <div className="text-[11px] font-semibold text-emerald-700 mb-1 inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Wysłana odpowiedź
          </div>
          <div className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-6">{c.humanAnswer ?? '—'}</div>
        </div>
      </div>

      {/* Propozycja wpisu FAQ (edytowalna) */}
      <div className="space-y-2 pt-1">
        <div className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
          <GraduationCap className="h-3.5 w-3.5" /> Propozycja wpisu FAQ {canEdit ? '(edytuj jeśli trzeba)' : ''}
        </div>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pytanie kanoniczne…"
          className="text-sm"
          disabled={!canEdit}
        />
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          placeholder="Odpowiedź / procedura…"
          className="text-sm"
          disabled={!canEdit}
        />
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Kategoria (np. reklamacje, dostawa, b2b)…"
          className="text-sm w-64"
          disabled={!canEdit}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {canEdit ? (
          <>
            <Button variant="outline" onClick={onReject} disabled={pending} className="gap-1.5 text-slate-600">
              <X className="h-4 w-4" /> Odrzuć
            </Button>
            <Button onClick={onApprove} disabled={pending || !question.trim() || !answer.trim()} className="gap-1.5">
              <Check className="h-4 w-4" />
              {pending ? 'Dodaję…' : 'Dodaj do FAQ'}
            </Button>
          </>
        ) : (
          <span className="text-xs text-slate-400">tylko podgląd</span>
        )}
      </div>
    </div>
  )
}
