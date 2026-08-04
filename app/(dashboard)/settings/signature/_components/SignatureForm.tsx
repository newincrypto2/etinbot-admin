'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Bold, Italic, Link2, Image as ImageIcon, Eraser, Code2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/actions/signature'

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
  const editorRef = useRef<HTMLDivElement>(null)

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

  const onPaste = (e: React.ClipboardEvent) => {
    // Czysty tekst zamiast HTML z Worda/Gmaila (style, spany, komentarze MSO)
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
      // powrót do wizualnego — wstrzyknij aktualny HTML do edytora
      setMode('visual')
      requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.innerHTML = html
      })
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
            <button type="button" title="Wstaw obrazek (URL)" className={toolBtn}
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
              // initial tylko przy pierwszym renderze — dalej DOM-em rządzi user;
              // prop się nie zmienia, więc React nie nadpisuje treści edytora
              dangerouslySetInnerHTML={{ __html: initial }}
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

        <p className="text-xs text-slate-500 mt-1.5">
          Zaznacz tekst i użyj przycisków, żeby pogrubić albo dodać link. Obrazek (np. logo)
          wstawisz przez URL. Wklejany tekst trafia bez obcego formatowania.
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
