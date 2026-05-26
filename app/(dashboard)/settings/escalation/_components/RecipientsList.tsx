'use client'

import { useState } from 'react'
import { Pencil, Shield, Building2, Briefcase, Crown, MessageSquareOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ActionResult } from '@/actions/client'
import type { EscalationRecipient } from '@/queries/notifications'

import { RecipientForm } from './RecipientForm'
import { DeleteRecipientButton } from './DeleteRecipientButton'

type Props = {
  recipients: EscalationRecipient[]
  upsertAction: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  deleteAction: (state: ActionResult, fd: FormData) => Promise<ActionResult>
}

const ROLE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  office: { label: 'Biuro', icon: <Briefcase className="h-3 w-3" />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  security: { label: 'Ochrona 24/7', icon: <Shield className="h-3 w-3" />, color: 'bg-red-50 text-red-700 border-red-200' },
  manager: { label: 'Manager', icon: <Briefcase className="h-3 w-3" />, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  owner: { label: 'Właściciel', icon: <Crown className="h-3 w-3" />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const SCOPE_LABEL: Record<string, string> = {
  'silver-place': 'Silver Place',
  'silver-forest': 'Silver Forest',
}

const SEVERITY_LABEL: Record<string, string> = {
  all: 'wszystkie',
  urgent_only: 'tylko pilne',
  normal_only: 'tylko zwykłe',
}

export function RecipientsList({ recipients, upsertAction, deleteAction }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {recipients.length === 0 && !showAdd && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          Brak odbiorców SMS — bot przy eskalacji NIKOGO nie powiadomi. Dodaj przynajmniej jeden numer.
        </div>
      )}

      {recipients.map((r) => {
        const meta = ROLE_META[r.role] ?? ROLE_META.office
        const isEditing = editing === r.id
        return (
          <div
            key={r.id}
            className={`rounded-lg border p-4 ${r.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}
          >
            {isEditing ? (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium">Edytuj odbiorcę</h3>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Anuluj</Button>
                </div>
                <RecipientForm action={upsertAction} initial={r} onDone={() => setEditing(null)} />
              </>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    <Badge variant="outline" className={`${meta.color} gap-1 text-[10px] py-0 h-5`}>
                      {meta.icon}
                      {meta.label}
                    </Badge>
                    {!r.smsEnabled && (
                      <Badge variant="outline" className="bg-slate-50 text-slate-500 gap-1 text-[10px] py-0 h-5">
                        <MessageSquareOff className="h-3 w-3" />
                        SMS off
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    <code className="font-mono">{r.phone}</code>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {r.scope ? SCOPE_LABEL[r.scope] ?? r.scope : 'wszystkie budynki'}
                    </span>
                    <span>·</span>
                    <span>powiadomienia: {SEVERITY_LABEL[r.severityFilter] ?? r.severityFilter}</span>
                    {r.note && (
                      <>
                        <span>·</span>
                        <span className="italic">{r.note}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(r.id)} className="gap-1">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <DeleteRecipientButton id={r.id} name={r.name} action={deleteAction} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {showAdd ? (
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium">Nowy odbiorca SMS</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Anuluj</Button>
          </div>
          <RecipientForm action={upsertAction} onDone={() => setShowAdd(false)} />
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)} className="w-full">
          + Dodaj odbiorcę SMS
        </Button>
      )}
    </div>
  )
}
