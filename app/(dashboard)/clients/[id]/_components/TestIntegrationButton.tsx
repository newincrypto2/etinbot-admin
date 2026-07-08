'use client'

import { useState } from 'react'
import { Loader2, Check, X, PlugZap } from 'lucide-react'

import { testIntegration, type IntegrationTestResult } from '@/actions/clients'

type Integration = 'woocommerce' | 'baselinker' | 'email' | 'messenger' | 'allegro'

export function TestIntegrationButton({ slug, integration }: { slug: string; integration: Integration }) {
  const [pending, setPending] = useState(false)
  const [res, setRes] = useState<IntegrationTestResult | null>(null)

  const run = async () => {
    setPending(true)
    setRes(null)
    const r = await testIntegration(integration, {}, slug)
    setRes(r)
    setPending(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
        Testuj
      </button>
      {res && (
        <span className={`text-xs inline-flex items-center gap-1 ${res.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {res.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {res.ok ? res.detail || 'OK' : res.error || 'Błąd'}
        </span>
      )}
    </div>
  )
}
