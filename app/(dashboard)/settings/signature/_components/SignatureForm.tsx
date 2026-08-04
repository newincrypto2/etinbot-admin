'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Bold, Italic, Link2, Image as ImageIcon, Eraser, Code2, Loader2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { uploadSignatureImage, type ActionResult } from '@/actions/signature'

/**
 * Edytor wizualny (WYSIWYG) na contentEditable — bez nowych zależności.
 * document.execCommand jest deprecated, ale działa we wszystkich przeglądarkach
 * i dla stopki (bold/italic/link/obrazek) w zupełności wystarcza. Wklejanie
 * przechwytujemy jako CZYSTY TEKST (wklejka z Worda/Gmaila nie zaśmieca HTML).
 * Ostateczna sanityzacja i tak jest po stronie backendu przy zapisie.
 */
export function SignatureForm({ action, initial }: {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>
  initial: string
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false })
  const [html, setHtml] = useState(initial)
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Dialog wyboru pliku zabiera focus edytorowi — zapamiętujemy pozycję kursora,
  // żeby po uploadzie wstawić obrazek tam gdzie stał kursor, nie na początku.
  const savedRange = useRef<Range | null>(null)

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
      // brak zapamiętanej pozycji → kursor na koniec treści
      const range = document.createRange()
      range.selectNodeContents(ed)
      range.collapse(false)
      sel.addRange(range)
    }
  }

  const syncFromEditor = () => {
    if (editorRef.current) setHtml(editorRef.current.innerHTML)
  }

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    syncFromEditor()
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

  const onAddImage = () => {
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
    e.target.value = '' // pozwól wybrać ten sam plik ponownie
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
    // Czysty tekst zamiast HTML z Worda/Gmaila (style, spany, komentarze MSO)
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    syncFromEditor()
  }

  // Treść edytora ustawiana IMPERATYWNIE (mount + powrót z trybu HTML).
  // UWAGA: żadnego dangerouslySetInnerHTML na contentEditable — React 19
  // re-aplikuje je przy każdym re-renderze (np. po setHtml z onInput)
  // i cofa edytor do wartości początkowej, kasując to co user wpisał.
  useEffect(() => {
    if (mode === 'visual' && editorRef.current) {
      editorRef.current.innerHTML = html
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const toggleMode = () => {
    if (mode === 'visual') {
      syncFromEditor()
      setMode('html')
    } else {
      setMode('visual') // useEffect wstrzyknie aktualny HTML
    }
  }

  const toolBtn =
    'inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors'

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <div className={`rounded-md border px-4 py-2.5 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {state.message}
        </div>
      )}

      {/* Wartość do server action — zawsze aktualny HTML niezależnie od trybu */}
      <input type="hidden" name="signatureHtml" value={html} />

      <div>
        <Label className="text-sm font-medium block mb-1.5">Twoja stopka</Label>

        <div className="rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-300">
          {/* Toolbar */}
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
            <button type="button" title="Wgraj obrazek z dysku (logo)" className={toolBtn}
              onMouseDown={(e) => e.preventDefault()} onClick={onPickUpload}
              disabled={mode === 'html' || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </button>
            <button type="button" title="Wstaw obrazek z adresu URL" className={toolBtn}
              onMouseDown={(e) => e.preventDefault()} onClick={onAddImage}
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

          {/* Edytor */}
          {mode === 'visual' ? (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncFromEditor}
              onBlur={syncFromEditor}
              onPaste={onPaste}
              className="min-h-[10rem] px-3 py-2.5 text-sm leading-relaxed focus:outline-none [&_a]:text-indigo-600 [&_a]:underline [&_img]:max-h-24 [&_img]:inline-block"
            />
          ) : (
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full px-3 py-2.5 text-sm bg-white font-mono leading-relaxed resize-y focus:outline-none rounded-b-md"
            />
          )}
        </div>

        {/* ukryty input pliku dla przycisku uploadu */}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={onUploadFile}
        />

        {uploadError && (
          <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>
        )}
        <p className="text-xs text-slate-500 mt-1.5">
          Zaznacz tekst i użyj przycisków, żeby pogrubić albo dodać link. Logo wgrasz z dysku
          (PNG/JPG/GIF/WEBP, max 2 MB) albo wstawisz przez URL. Wklejany tekst trafia bez
          obcego formatowania.
        </p>
      </div>

      <div>
        <Label className="text-sm font-medium block mb-1.5">Podgląd</Label>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Podgląd
          </div>
          <div className="text-sm text-slate-700">
            <div className="mb-2 text-slate-500">Pozdrawiam,</div>
            {html.replace(/<br\s*\/?>(\s*)/gi, '').trim() ? (
              <div className="[&_img]:max-h-24" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div className="text-slate-400 italic">
                (brak stopki — wpisz treść powyżej, żeby zobaczyć podgląd)
              </div>
            )}
          </div>
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Zapisywanie...' : 'Zapisz stopkę'}
    </Button>
  )
}
