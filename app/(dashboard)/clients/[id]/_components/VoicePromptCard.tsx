'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles, Copy, Check, ChevronDown, ChevronRight, Save, Phone } from 'lucide-react'

import {
  generateVoicePrompt,
  saveAgentId,
  type VoiceTool,
} from '@/actions/voice-prompt'

const STEPS = [
  'Utwórz agenta w ElevenLabs (nazwa, głos PL, model, powitanie).',
  'Wklej wygenerowany system prompt w pole „System prompt" agenta.',
  'Utwórz narzędzia (Tools) z poniższej checklisty — nazwa, metoda, URL, body. Nagłówek Authorization: Bearer <KB_API_KEY> (z env Coolify).',
  'Skopiuj agent_id z ElevenLabs i wpisz poniżej, aby aktywować kanał voice.',
  'Przepnij numer Twilio na SIP URI agenta (Twilio → Phone Numbers → Voice).',
]

export function VoicePromptCard({
  slug,
  initialAgentId,
}: {
  slug: string
  initialAgentId: string | null
}) {
  const [loaded, setLoaded] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [tools, setTools] = useState<VoiceTool[]>([])
  const [toolsNote, setToolsNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [agentId, setAgentId] = useState(initialAgentId ?? '')
  const [savedAgentId, setSavedAgentId] = useState(initialAgentId ?? '')
  const [savingAgent, startSaveAgent] = useTransition()

  const [copied, setCopied] = useState(false)
  const [openTool, setOpenTool] = useState<string | null>(null)

  const generate = () =>
    startTransition(async () => {
      setError(null)
      const r = await generateVoicePrompt(slug)
      if (!r.ok) {
        setError(r.message)
        return
      }
      setPrompt(r.prompt)
      setTools(r.tools)
      setToolsNote(r.toolsNote)
      if (r.agentId != null) {
        setAgentId(r.agentId)
        setSavedAgentId(r.agentId)
      }
      setLoaded(true)
    })

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Nie udało się skopiować — zaznacz i skopiuj ręcznie.')
    }
  }

  const saveAgent = () =>
    startSaveAgent(async () => {
      const r = await saveAgentId(slug, agentId)
      if (r.ok) {
        toast.success(r.message)
        setSavedAgentId(r.agentId ?? '')
      } else {
        toast.error(r.message)
      }
    })

  const agentDirty = agentId.trim() !== savedAgentId.trim()

  return (
    <div className="bg-white rounded-lg border p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
            <Phone className="h-4 w-4" /> Prompt voice (ElevenLabs)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Generuje gotowy system prompt i checklistę narzędzi — koniec ręcznego składania przy onboardingu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAgentId ? (
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">voice aktywny</span>
          ) : (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">brak agenta</span>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loaded ? 'Wygeneruj ponownie' : 'Wygeneruj'}
          </button>
        </div>
      </div>

      {/* Instrukcja krokowa */}
      <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-5 bg-slate-50 border border-slate-200 rounded-md p-3">
        {STEPS.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{error}</div>
      )}

      {loaded && (
        <>
          {/* (1) Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">System prompt</label>
              <button
                type="button"
                onClick={copyPrompt}
                className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-800 whitespace-pre-wrap font-mono">
              {prompt}
            </pre>
          </div>

          {/* (2) Checklista narzędzi */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Narzędzia do utworzenia w ElevenLabs ({tools.length})
            </label>
            {toolsNote && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">{toolsNote}</p>
            )}
            <div className="rounded-md border border-slate-200 divide-y">
              {tools.map((t) => {
                const open = openTool === t.name
                return (
                  <div key={t.name}>
                    <button
                      type="button"
                      onClick={() => setOpenTool(open ? null : t.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="text-[11px] font-semibold uppercase text-slate-400 w-10 shrink-0">{t.method}</span>
                      <code className="text-xs font-mono text-slate-800 shrink-0">{t.name}</code>
                      <span className="text-xs text-slate-400 truncate ml-1">{t.url}</span>
                    </button>
                    {open && (
                      <div className="px-3 pb-3 pl-9 space-y-2 text-xs text-slate-600">
                        <p>{t.description_pl}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
                          <span>
                            <span className="font-medium text-slate-600">URL:</span> <code className="font-mono">{t.url}</code>
                          </span>
                          <span>
                            <span className="font-medium text-slate-600">Auth:</span>{' '}
                            {t.auth ? `Bearer <${t.auth}>` : 'brak (publiczne GET)'}
                          </span>
                        </div>
                        {t.body_schema != null && (
                          <div>
                            <div className="font-medium text-slate-600 mb-1">Body schema:</div>
                            <pre className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px] overflow-auto max-h-56 font-mono">
                              {JSON.stringify(t.body_schema, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* (3) agent_id — dostępne zawsze, żeby dało się wpisać po utworzeniu agenta */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-700">agent_id (z ElevenLabs)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="agent_xxxxxxxxxxxxxxxxxxxxxxxx"
            className="flex-1 min-w-[220px] h-9 px-3 rounded-md border border-slate-300 text-sm font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
          />
          <button
            type="button"
            onClick={saveAgent}
            disabled={savingAgent || !agentDirty}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingAgent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz agent_id
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Zapis ustawia kolumnę elevenlabs_agent_id — po zapisaniu kanał voice liczy się jako skonfigurowany. Puste pole czyści.
        </p>
      </div>
    </div>
  )
}
