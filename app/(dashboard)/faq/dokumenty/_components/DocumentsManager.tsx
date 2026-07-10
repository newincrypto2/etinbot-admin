'use client'

import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
  Undo2,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

type DocRow = {
  id: string
  filename: string
  mime: string | null
  size_bytes: number | null
  status: string
  error: string | null
  faq_count: number
  tokens_in: number
  tokens_out: number
  cost_pln: string
  created_at: string
  processed_at: string | null
}

const STATUS: Record<string, { label: string; cls: string; icon?: 'spin' | 'ok' | 'err' }> = {
  queued: { label: 'W kolejce', cls: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Przetwarzanie', cls: 'bg-amber-100 text-amber-800', icon: 'spin' },
  done: { label: 'Gotowe', cls: 'bg-emerald-100 text-emerald-700', icon: 'ok' },
  failed: { label: 'Błąd', cls: 'bg-red-100 text-red-700', icon: 'err' },
  undone: { label: 'Cofnięty', cls: 'bg-slate-100 text-slate-500' },
}

const ACCEPT = '.pdf,.docx,.txt,.md'
const MAX_BYTES = 5 * 1024 * 1024

function isActive(docs: DocRow[]): boolean {
  return docs.some((d) => d.status === 'queued' || d.status === 'processing')
}

function fmtCost(v: string): string {
  const n = Number(v)
  if (!isFinite(n) || n === 0) return '—'
  return n.toLocaleString('pl-PL', { minimumFractionDigits: n < 0.01 ? 4 : 2, maximumFractionDigits: 4 }) + ' zł'
}

export function DocumentsManager({ canEdit }: { canEdit: boolean }) {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [undoTarget, setUndoTarget] = useState<DocRow | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef(false)

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/kb-documents', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as DocRow[]
      if (Array.isArray(data)) {
        setDocs(data)
        activeRef.current = isActive(data)
      }
    } catch {
      /* ignore — kolejny cykl spróbuje ponownie */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
    // polling co 10 s — odświeża tylko gdy coś jest w toku (kolejka/przetwarzanie)
    const t = setInterval(() => {
      if (activeRef.current) fetchList()
    }, 10_000)
    return () => clearInterval(t)
  }, [fetchList])

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return
      const tooBig = list.filter((f) => f.size > MAX_BYTES)
      if (tooBig.length) {
        toast.error(`Za duże pliki (max 5 MB): ${tooBig.map((f) => f.name).join(', ')}`)
      }
      const ok = list.filter((f) => f.size <= MAX_BYTES)
      if (ok.length === 0) return

      const form = new FormData()
      ok.forEach((f) => form.append('files', f, f.name))
      setUploading(true)
      try {
        const res = await fetch('/api/kb-documents', { method: 'POST', body: form })
        const text = await res.text()
        if (!res.ok) {
          toast.error(`Upload nieudany: ${text.slice(0, 200)}`)
          return
        }
        const data = JSON.parse(text) as { documents: { filename: string; status: string; error: string | null }[] }
        const failed = data.documents.filter((d) => d.status === 'failed')
        const queued = data.documents.length - failed.length
        if (queued > 0) toast.success(`Dodano ${queued} dokument(ów) do kolejki.`)
        failed.forEach((d) => toast.error(`${d.filename}: ${d.error ?? 'błąd'}`))
        await fetchList()
        activeRef.current = true
      } catch (e) {
        toast.error(`Błąd uploadu: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [fetchList],
  )

  const doAction = useCallback(
    async (doc: DocRow, action: 'undo' | 'retry') => {
      setBusyId(doc.id)
      try {
        const res = await fetch(`/api/kb-documents/${doc.id}?action=${action}`, { method: 'POST' })
        const text = await res.text()
        if (!res.ok) {
          toast.error(text.slice(0, 200))
          return
        }
        if (action === 'undo') {
          const data = JSON.parse(text) as { removed_faq: number }
          toast.success(`Cofnięto import — usunięto ${data.removed_faq} wpis(ów) FAQ.`)
        } else {
          toast.success('Ponowiono — dokument wróci do kolejki.')
        }
        await fetchList()
      } catch (e) {
        toast.error(`Błąd: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setBusyId(null)
      }
    },
    [fetchList],
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!canEdit) return
    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-slate-400'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          ) : (
            <UploadCloud className="h-8 w-8 text-slate-400" />
          )}
          <div className="text-sm font-medium text-slate-700">
            {uploading ? 'Wgrywanie…' : 'Przeciągnij pliki tutaj lub kliknij, aby wybrać'}
          </div>
          <div className="text-xs text-slate-400">PDF, DOCX, TXT, MD — do 5 MB każdy. Można wgrać kilka naraz.</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
        </div>
      )}

      {/* Lista */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
          <div className="text-sm font-medium text-slate-700">Wgrane dokumenty</div>
          {isActive(docs) && (
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> odświeżanie na żywo
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide">Dokument</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wide w-36">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600 uppercase tracking-wide w-24">Wpisy FAQ</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600 uppercase tracking-wide w-28">Koszt</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600 uppercase tracking-wide w-40">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Ładowanie…</td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Brak dokumentów. Wgraj pierwszy plik powyżej.
                  </td>
                </tr>
              ) : (
                docs.map((d) => {
                  const st = STATUS[d.status] ?? { label: d.status, cls: 'bg-slate-100 text-slate-600' }
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 break-all">{d.filename}</div>
                            {d.error && (
                              <div className={`text-xs mt-0.5 ${d.status === 'failed' ? 'text-red-600' : 'text-slate-400'}`}>
                                {d.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${st.cls}`}>
                          {st.icon === 'spin' && <Loader2 className="h-3 w-3 animate-spin" />}
                          {st.icon === 'ok' && <CheckCircle2 className="h-3 w-3" />}
                          {st.icon === 'err' && <AlertCircle className="h-3 w-3" />}
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {d.status === 'done' ? d.faq_count : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600" title="Koszt netto przetwarzania (LLM + embeddingi)">
                        {fmtCost(d.cost_pln)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {canEdit && d.status === 'done' && d.faq_count > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-600 hover:text-red-600 gap-1"
                              disabled={busyId === d.id}
                              onClick={() => setUndoTarget(d)}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Cofnij
                            </Button>
                          )}
                          {canEdit && (d.status === 'failed' || d.status === 'undone') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-indigo-600 hover:text-indigo-700 gap-1"
                              disabled={busyId === d.id}
                              onClick={() => doAction(d, 'retry')}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Ponów
                            </Button>
                          )}
                          {busyId === d.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Potwierdzenie cofnięcia importu */}
      <AlertDialog open={!!undoTarget} onOpenChange={(o) => !o && setUndoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cofnąć import z tego dokumentu?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoTarget && (
                <>
                  Z dokumentu <span className="font-medium text-slate-700">„{undoTarget.filename}&rdquo;</span> powstało{' '}
                  <span className="font-medium text-slate-700">{undoTarget.faq_count}</span> wpis(ów) FAQ.
                  <br />
                  <br />
                  Wszystkie zostaną usunięte z bazy FAQ. Sam dokument zostaje — możesz go później ponowić.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (undoTarget) doAction(undoTarget, 'undo')
                setUndoTarget(null)
              }}
            >
              Cofnij import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
