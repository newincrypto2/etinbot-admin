'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, X, Inbox } from 'lucide-react'

import { readFilteredMail, restoreFromSpam } from '@/actions/email'
import { fmtDateTime } from '@/lib/datetime'

type FilteredMail = {
  id: string
  fromName: string | null
  fromAddress: string | null
  subject: string | null
  snippet: string | null
  isSpam: boolean
  reason: string | null
  receivedAt: Date
}

export function FilteredMailRow({ m }: { m: FilteredMail }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [restoring, startRestore] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  const onRestore = () => {
    setErr(null)
    startRestore(async () => {
      const r = await restoreFromSpam(m.id)
      if (r.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setErr(r.message)
      }
    })
  }

  const onOpen = () => {
    setOpen(true)
    if (body === null) {
      start(async () => {
        const r = await readFilteredMail(m.id)
        setBody(r.ok ? (r.body ?? '(brak treści)') : `Nie udało się pobrać treści. ${r.message ?? ''}`)
      })
    }
  }

  return (
    <>
      <li
        onClick={onOpen}
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="mt-0.5 h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 text-slate-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 truncate">{m.fromName || m.fromAddress || '—'}</span>
            <span className="text-xs text-slate-400 truncate">{m.fromAddress}</span>
          </div>
          <div className="text-sm text-slate-600 truncate mt-0.5">{m.subject || '(bez tematu)'}</div>
          {m.snippet && <div className="text-[11px] text-slate-400 truncate mt-0.5">{m.snippet}</div>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${m.isSpam ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
            {m.isSpam ? 'spam' : 'automat / pętla'}
          </span>
          {m.reason && (
            <span className="text-[10px] text-slate-400 max-w-[220px] truncate" title={m.reason}>
              {m.reason}
            </span>
          )}
          <span className="text-[10px] text-slate-300">{fmtDateTime(m.receivedAt)}</span>
        </div>
      </li>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{m.subject || '(bez tematu)'}</div>
                <div className="text-xs text-slate-500 truncate">
                  {m.fromName ? `${m.fromName} · ` : ''}{m.fromAddress}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Odfiltrowane: {m.isSpam ? 'spam' : 'automat / pętla'}{m.reason ? ` · ${m.reason}` : ''}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {pending && body === null ? (
                <div className="text-sm text-slate-400">Wczytuję treść…</div>
              ) : (
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-slate-800">{body}</div>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3">
              {err ? <span className="text-xs text-rose-600 truncate">{err}</span> : <span className="text-xs text-slate-400">To wiadomość od klienta?</span>}
              <button
                onClick={onRestore}
                disabled={restoring}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
              >
                <Inbox className="h-4 w-4" />
                {restoring ? 'Przenoszę…' : 'NIE spam — przenieś do Poczty'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
