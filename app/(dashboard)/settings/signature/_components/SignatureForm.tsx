'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/signature'

const PLACEHOLDER = `Jan Kowalski
Specjalista ds. obsługi klienta
tel. +48 600 100 200`

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

      <div>
        <Label className="text-sm font-medium block mb-1.5">Twoja stopka (HTML)</Label>
        <textarea
          name="signatureHtml"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={8}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm bg-white font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          Dozwolone znaczniki: <code>p, br, b, strong, a, span</code>. Obrazki dodasz przez URL
          (<code>&lt;img src="https://..."&gt;</code>). Resztę backend odfiltruje przy zapisie.
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
            {html.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
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
