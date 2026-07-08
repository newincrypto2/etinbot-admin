'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Send, FlaskConical, Trash2 } from 'lucide-react'

import { sandboxChat, type SandboxMessage, type SandboxToolCall } from '@/actions/clients'

type Turn = {
  role: 'user' | 'assistant'
  content: string
  tools?: SandboxToolCall[]
  latencyMs?: number
  escalated?: boolean
}

export function SandboxChat({ slug }: { slug: string }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, pending])

  const send = async () => {
    const msg = input.trim()
    if (!msg || pending) return
    setError(null)
    setInput('')
    const history: SandboxMessage[] = turns.map((t) => ({ role: t.role, content: t.content }))
    setTurns((prev) => [...prev, { role: 'user', content: msg }])
    setPending(true)
    const r = await sandboxChat(slug, msg, history, { email: email || undefined, phone: phone || undefined })
    setPending(false)
    if (!r.ok) {
      setError(r.message)
      return
    }
    setTurns((prev) => [
      ...prev,
      { role: 'assistant', content: r.text, tools: r.tools, latencyMs: r.latencyMs, escalated: r.escalated },
    ])
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-amber-50">
        <span className="text-xs font-semibold text-amber-800 inline-flex items-center gap-1.5">
          <FlaskConical className="h-4 w-4" /> Sandbox — rozmowa testowa, nie zapisuje się
        </span>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => { setTurns([]); setError(null) }}
            className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <Trash2 className="h-3.5 w-3.5" /> Wyczyść
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-2 border-b bg-slate-50">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail testowy (opcjonalnie)" className="flex-1 min-w-[160px] h-8 px-2.5 rounded-md border border-slate-300 text-xs" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="telefon testowy (opcjonalnie)" className="flex-1 min-w-[160px] h-8 px-2.5 rounded-md border border-slate-300 text-xs" />
      </div>

      <div className="h-[380px] overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
        {turns.length === 0 && (
          <div className="text-center text-sm text-slate-400 pt-12">
            Napisz wiadomość, aby przetestować bota tego tenanta.
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${t.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
              {t.content}
              {t.role === 'assistant' && (t.tools?.length || t.escalated || t.latencyMs != null) && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-400 space-y-0.5">
                  {t.tools && t.tools.length > 0 && (
                    <div>narzędzia: {t.tools.map((x) => x.name).filter(Boolean).join(', ')}</div>
                  )}
                  {t.escalated && <div className="text-red-500">eskalacja</div>}
                  {t.latencyMs != null && <div>{t.latencyMs} ms</div>}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-white border border-slate-200">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">{error}</div>}

      <div className="flex items-center gap-2 px-4 py-3 border-t bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Wpisz wiadomość testową…"
          disabled={pending}
          className="flex-1 h-10 px-3 rounded-md border border-slate-300 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !input.trim()}
          className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Wyślij
        </button>
      </div>
    </div>
  )
}
