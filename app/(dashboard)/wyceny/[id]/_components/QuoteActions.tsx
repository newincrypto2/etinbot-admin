'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Check, X, Mail } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createQuoteEmailDraft, reanalyzeQuote, setQuoteStatus } from '@/actions/quotes'

type Props = {
  id: string
  status: string
  customerEmail: string | null
  /** Adresy skrzynek tenanta (jak w Poczcie); pusta lista → input tekstowy. */
  mailboxes: string[]
}

export function QuoteActions({ id, status, customerEmail, mailboxes }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [draftOpen, setDraftOpen] = useState(false)
  const [mailbox, setMailbox] = useState(mailboxes[0] ?? '')
  const [toAddress, setToAddress] = useState(customerEmail ?? '')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')

  const canApprove = status === 'ready'
  const canReject = status !== 'sent' && status !== 'rejected'
  const canDraft = status === 'ready' || status === 'approved'

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (r.ok) {
        toast.success(r.message)
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })

  const onReanalyze = () => run(() => reanalyzeQuote(id))
  const onApprove = () => run(() => setQuoteStatus(id, 'approved'))
  const onReject = () => {
    if (!confirm('Odrzucić tę wycenę?')) return
    run(() => setQuoteStatus(id, 'rejected'))
  }

  const onCreateDraft = () =>
    startTransition(async () => {
      const r = await createQuoteEmailDraft(id, {
        mailboxAddress: mailbox,
        toAddress,
        subject,
        bodyText,
      })
      if (r.ok && r.conversationId) {
        toast.success(r.message)
        setDraftOpen(false)
        router.push(`/poczta/${r.conversationId}`)
      } else if (r.ok) {
        toast.success(r.message)
        setDraftOpen(false)
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onReanalyze} disabled={pending}>
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} /> Analizuj ponownie
      </Button>
      {canApprove && (
        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={onApprove} disabled={pending}>
          <Check className="h-4 w-4" /> Zatwierdź
        </Button>
      )}
      {canDraft && (
        <Button size="sm" className="gap-1.5" onClick={() => setDraftOpen(true)} disabled={pending}>
          <Mail className="h-4 w-4" /> Utwórz draft e-maila
        </Button>
      )}
      {canReject && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
          onClick={onReject}
          disabled={pending}
        >
          <X className="h-4 w-4" /> Odrzuć
        </Button>
      )}

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Draft e-maila z wyceną</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500">Ze skrzynki</label>
              {mailboxes.length > 0 ? (
                <select
                  value={mailbox}
                  onChange={(e) => setMailbox(e.target.value)}
                  className="mt-1 w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white"
                >
                  {mailboxes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={mailbox}
                  onChange={(e) => setMailbox(e.target.value)}
                  placeholder="np. sklep@krainaherbaty.pl (adres skrzynki tenanta)"
                  className="mt-1 text-sm"
                />
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500">Do</label>
              <Input
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="adres@klienta.pl"
                className="mt-1 text-sm"
              />
              {!customerEmail && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Wycena nie ma adresu e-mail klienta — podaj adres odbiorcy.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500">Temat (opcjonalnie)</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="puste = temat wygeneruje bot"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Treść (opcjonalnie)</label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={5}
                placeholder="puste = treść z wyceną wygeneruje bot"
                className="mt-1 text-sm leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter>
            <p className="text-[11px] text-slate-400 mr-auto self-center">
              Powstanie szkic w Poczcie — nic nie wychodzi bez Twojej akceptacji.
            </p>
            <Button onClick={onCreateDraft} disabled={pending || !mailbox.trim() || !toAddress.trim()}>
              {pending ? 'Tworzę…' : 'Utwórz draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
