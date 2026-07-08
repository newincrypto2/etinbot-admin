'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function ConfigViewer({ json }: { json: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Podgląd read-only. Wartości sekretów (tokeny, hasła, klucze) są zamaskowane (•••).
        </p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(json)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Skopiowano' : 'Kopiuj'}
        </button>
      </div>
      <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto max-h-[520px] overflow-y-auto">
        {json}
      </pre>
    </div>
  )
}
