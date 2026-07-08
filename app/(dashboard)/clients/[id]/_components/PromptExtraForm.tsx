'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

import { savePromptExtra } from '@/actions/clients'

export function PromptExtraForm({ slug, initial }: { slug: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [pending, startTransition] = useTransition()
  const dirty = text !== initial

  const save = () =>
    startTransition(async () => {
      const r = await savePromptExtra(slug, text)
      if (r.ok) toast.success(r.message)
      else toast.error(r.message)
    })

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 block">
        Dodatkowe reguły promptu (prompt_extra)
      </label>
      <p className="text-xs text-slate-500">
        Doklejane na końcu promptu bota — bez deployu. Zostaw puste, jeśli niepotrzebne.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className="w-full rounded-md border border-slate-300 text-sm px-3 py-2 font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
        placeholder="np. Nigdy nie obiecuj rabatów bez zgody. Godziny wysyłki: do 12:00."
      />
      <button
        type="button"
        onClick={save}
        disabled={pending || !dirty}
        className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Zapisz reguły
      </button>
    </div>
  )
}
