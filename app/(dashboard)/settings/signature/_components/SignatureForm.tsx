'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/RichTextEditor'
import type { ActionResult } from '@/actions/signature'

export function SignatureForm({ action, initial }: {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial: string
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })
  const [html, setHtml] = useState(initial)

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <div className={`rounded-md border px-4 py-2.5 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      {/* Wartość do server action — zawsze aktualny HTML niezależnie od trybu */}
      <input type="hidden" name="signatureHtml" value={html} />

      <div>
        <Label className="text-sm font-medium block mb-1.5">Twoja stopka</Label>
        <RichTextEditor initialHtml={initial} onChange={setHtml} />
        <p className="text-xs text-slate-500 mt-1.5">
          Zaznacz tekst i użyj przycisków, żeby pogrubić albo dodać link. Logo wgrasz z dysku
          (PNG/JPG/GIF/WEBP, max 2 MB) albo wstawisz przez URL. Wklejany tekst trafia bez
          obcego formatowania.
        </p>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-1.5">Podgląd</Label>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Podgląd
          </div>
          <div className="text-sm text-slate-700">
            <div className="mb-2 text-slate-500">Pozdrawiam,</div>
            {html.replace(/<br\s*\/?>(\s*)/gi, '').trim() ? (
              <div className="[&_img]:max-h-24" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div className="text-slate-400 italic">
                (brak stopki — wpisz treść powyżej, żeby zobaczyć podgląd)
              </div>
            )}
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : 'Zapisz stopkę'}
    </Button>
  )
}
