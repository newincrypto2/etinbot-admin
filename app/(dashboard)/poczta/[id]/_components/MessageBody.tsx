'use client'

import { useRef, useState } from 'react'
import { Code2, FileText, Loader2 } from 'lucide-react'

import { getInboundHtml } from '@/actions/email'

/**
 * Treść wiadomości w wątku: tekst (default) ↔ oryginalny HTML maila klienta.
 *
 * HTML klienta to NIEZAUFANA treść — renderujemy ją wyłącznie w iframe
 * z sandboxem: `allow-same-origin` (żeby zmierzyć wysokość dokumentu) ale BEZ
 * `allow-scripts` — skrypty/formularze/popupy są martwe z definicji (anty-XSS
 * w zalogowanym panelu). Toggle tylko dla wiadomości klienta (inboundId).
 */
export function MessageBody({ text, inboundId }: { text: string; inboundId: string | null }) {
  const [view, setView] = useState<'text' | 'html'>('text')
  const [html, setHtml] = useState<string | null | undefined>(undefined) // undefined = nie pobrano
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [frameH, setFrameH] = useState(360)

  const toggle = async () => {
    setErr(null)
    if (view === 'html') {
      setView('text')
      return
    }
    if (html === undefined) {
      if (!inboundId) return
      setLoading(true)
      try {
        const r = await getInboundHtml(inboundId)
        if (!r.ok) {
          setErr(r.message ?? 'Nie udało się pobrać HTML.')
          return
        }
        if (!r.html) {
          setHtml(null)
          setErr('Ten mail nie ma wersji HTML (przyszedł jako czysty tekst).')
          return
        }
        setHtml(r.html)
      } finally {
        setLoading(false)
      }
    }
    if (html) setView('html')
    else if (html === null) setErr('Ten mail nie ma wersji HTML (przyszedł jako czysty tekst).')
  }

  const onFrameLoad = () => {
    // sandbox z allow-same-origin (bez allow-scripts) → można zmierzyć dokument
    try {
      const doc = frameRef.current?.contentDocument
      const h = doc?.documentElement?.scrollHeight ?? doc?.body?.scrollHeight
      if (h) setFrameH(Math.min(Math.max(h + 24, 120), 1200))
    } catch {
      /* zostaje domyślna wysokość */
    }
  }

  return (
    <div>
      {view === 'text' ? (
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{text}</div>
      ) : (
        <iframe
          ref={frameRef}
          sandbox="allow-same-origin"
          srcDoc={html ?? ''}
          onLoad={onFrameLoad}
          style={{ height: frameH }}
          className="w-full rounded-md border border-black/10 bg-white"
          title="Oryginalny mail (HTML)"
        />
      )}
      {inboundId && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={toggle}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-black/10 bg-white/60 hover:bg-white text-current opacity-70 hover:opacity-100 transition-all"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : view === 'text' ? (
              <Code2 className="h-3 w-3" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            {view === 'text' ? 'Pokaż oryginał (HTML)' : 'Pokaż tekst'}
          </button>
          {err && <span className="text-[11px] text-red-600/80">{err}</span>}
        </div>
      )}
    </div>
  )
}
