'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, ExternalLink, RefreshCw, Link2, CheckCircle2 } from 'lucide-react'

import { allegroDeviceStart, allegroDevicePoll } from '@/actions/client-config'

type StartState = {
  userCode: string
  verificationUri: string
  deviceCode: string
} | null

export function AllegroConnect({ slug, connected }: { slug: string; connected: boolean }) {
  const [starting, startStarting] = useTransition()
  const [polling, startPolling] = useTransition()
  const [flow, setFlow] = useState<StartState>(null)
  const [done, setDone] = useState(connected)

  if (done) {
    return (
      <div className="text-sm text-emerald-700 inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4" /> Allegro połączone.
      </div>
    )
  }

  const start = () =>
    startStarting(async () => {
      const r = await allegroDeviceStart(slug)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      setFlow({ userCode: r.userCode, verificationUri: r.verificationUri, deviceCode: r.deviceCode })
    })

  const poll = () => {
    if (!flow) return
    startPolling(async () => {
      const r = await allegroDevicePoll(slug, flow.deviceCode)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      if (r.status === 'connected') {
        toast.success(r.message)
        setDone(true)
        setFlow(null)
      } else {
        toast.message(r.message)
      }
    })
  }

  return (
    <div className="space-y-3">
      {!flow ? (
        <button
          type="button"
          onClick={start}
          disabled={starting}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Połącz z Allegro
        </button>
      ) : (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
          <p className="text-sm text-slate-700">
            1. Otwórz stronę autoryzacji i potwierdź kod{' '}
            <span className="font-mono font-semibold text-slate-900">{flow.userCode}</span>.
          </p>
          {flow.verificationUri && (
            <a
              href={flow.verificationUri}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-4 inline-flex items-center gap-2 rounded-md border border-orange-300 bg-white text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              <ExternalLink className="h-4 w-4" /> Otwórz autoryzację Allegro
            </a>
          )}
          <p className="text-sm text-slate-700">2. Po zatwierdzeniu kliknij „Sprawdź".</p>
          <button
            type="button"
            onClick={poll}
            disabled={polling}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sprawdź
          </button>
        </div>
      )}
    </div>
  )
}
