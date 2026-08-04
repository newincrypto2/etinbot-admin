'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Link2, Image as ImageIcon, Eraser, Code2, Loader2, Upload } from 'lucide-react'

import { uploadSignatureImage } from '@/actions/signature'

/**
 * Lekki edytor WYSIWYG na contentEditable — wspólny dla stopki i odpowiedzi
 * w Poczcie. Bez zewnętrznych zależności; produkuje prosty HTML (b/i/a/img/div),
 * ostateczna sanityzacja zawsze po stronie backendu.
 *
 * GOTCHA React 19: ŻADNEGO dangerouslySetInnerHTML na contentEditable —
 * jest re-aplikowane przy każdym re-renderze i kasuje wpisywany tekst.
 * Treść ustawiana imperatywnie przez ref (mount + powrót z trybu HTML).
 *
 * Wklejanie = czysty tekst (bez śmieci z Worda/Gmaila). Upload obrazka →
 * backend hostuje plik publicznie (signature-image) i wstawia <img src=URL>.
 */
export function RichTextEditor({
  initialHtml,
  onChange,
  minHeightClass = 'min-h-[10rem]',
  withImageUpload = true,
}: {
  initialHtml: string
  onChange: (html: string) => void
  minHeightClass?: string
  withImageUpload?: boolean
}) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const [html, setHtml] = useState(initialHtml)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Dialog pliku / prompt zabierają focus — pamiętamy kursor, żeby wstawiać w miejscu edycji.
  const savedRange = useRef<Range | null>(null)

  const update = (next: string) => {
    setHtml(next)
    onChange(next)
  }

  const syncFromEditor = () => {
    if (editorRef.current) update(editorRef.current.innerHTML)
  }

  // Treść edytora ustawiana IMPERATYWNIE (mount + powrót z trybu HTML) — patrz gotcha wyżej.
  useEffect(() => {
    if (mode === 'visual' && editorRef.current) {
      editorRef.current.innerHTML = html
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    syncFromEditor()
  }

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const ed = editorRef.current
    if (!ed) return
    ed.focus()
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    if (savedRange.current) {
      sel.addRange(savedRange.current)
    } else {
      const range = document.createRange()
      range.selectNodeContents(ed)
      range.collapse(false)
      sel.addRange(range)
    }
  }

  const onAddLink = () => {
    const url = window.prompt('Adres URL linku (https://...):')
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      window.alert('Link musi zaczynać się od http:// lub https://')
      return
    }
    exec('createLink', url)
  }

  const onAddImageUrl = () => {
    const url = window.prompt('Adres URL obrazka (https://...):')
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      window.alert('Adres obrazka musi zaczynać się od http:// lub https://')
      return
    }
    exec('insertImage', url)
  }

  const onPickUpload = () => {
    saveSelection()
    fileRef.current?.click()
  }

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await uploadSignatureImage(fd)
      if (!r.ok || !r.url) {
        setUploadError(r.message ?? 'Upload nie powiódł się.')
        return
      }
      restoreSelection()
      document.execCommand('insertImage', false, r.url)
      syncFromEditor()
    } finally {
      setUploading(false)
    }
  }

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    syncFromEditor()
  }

  const toggleMode = () => {
    if (mode === 'visual') {
      syncFromEditor()
      setMode('html')
    } else {
      setMode('visual') // useEffect wstrzyknie aktualny HTML
    }
  }

  const toolBtn =
    'inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40'

  return (
    <div className="rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-300">
      <div className="flex items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
        <button type="button" title="Pogrubienie" className={toolBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}
          disabled={mode === 'html'}>
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" title="Kursywa" className={toolBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}
          disabled={mode === 'html'}>
          <Italic className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" title="Wstaw link" className={toolBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={onAddLink}
          disabled={mode === 'html'}>
          <Link2 className="h-4 w-4" />
        </button>
        {withImageUpload && (
          <button type="button" title="Wgraj obrazek z dysku" className={toolBtn}
            onMouseDown={(e) => e.preventDefault()} onClick={onPickUpload}
            disabled={mode === 'html' || uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </button>
        )}
        <button type="button" title="Wstaw obrazek z adresu URL" className={toolBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={onAddImageUrl}
          disabled={mode === 'html'}>
          <ImageIcon className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" title="Wyczyść formatowanie" className={toolBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={() => { exec('removeFormat'); exec('unlink') }}
          disabled={mode === 'html'}>
          <Eraser className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button type="button" onClick={toggleMode}
          title={mode === 'visual' ? 'Edytuj źródło HTML' : 'Wróć do edytora wizualnego'}
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs transition-colors ${
            mode === 'html' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}>
          <Code2 className="h-3.5 w-3.5" /> HTML
        </button>
      </div>

      {mode === 'visual' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          onPaste={onPaste}
          className={`${minHeightClass} px-3 py-2.5 text-sm leading-relaxed focus:outline-none [&_a]:text-indigo-600 [&_a]:underline [&_img]:max-h-24 [&_img]:inline-block`}
        />
      ) : (
        <textarea
          value={html}
          onChange={(e) => update(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full px-3 py-2.5 text-sm bg-white font-mono leading-relaxed resize-y focus:outline-none rounded-b-md"
        />
      )}

      {uploadError && (
        <p className="text-xs text-red-600 px-3 pb-2">{uploadError}</p>
      )}
    </div>
  )
}

/** Plain text → HTML akapitowy (do inicjalizacji edytora treścią draftu bota). */
export function textToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
