'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PenSquare } from 'lucide-react'
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
import { composeEmail } from '@/actions/email'
import type { Mailbox } from '@/queries/email'

export function ComposeButton({ mailboxes }: { mailboxes: Mailbox[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [from, setFrom] = useState(mailboxes[0]?.address ?? '')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const onSubmit = () =>
    startTransition(async () => {
      const r = await composeEmail({ mailboxAddress: from, toAddress: to, subject, bodyText: body })
      if (r.ok && r.conversationId) {
        toast.success(r.message)
        setOpen(false)
        setTo('')
        setSubject('')
        setBody('')
        router.push(`/poczta/${r.conversationId}`)
      } else {
        toast.error(r.message)
      }
    })

  return (
    <>
      <Button className="gap-1.5" onClick={() => setOpen(true)}>
        <PenSquare className="h-4 w-4" /> Napisz nowy mail
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nowy mail</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {mailboxes.length > 1 ? (
            <div>
              <label className="text-xs text-slate-500">Z adresu</label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white"
              >
                {mailboxes.map((m) => (
                  <option key={m.address} value={m.address}>
                    {m.address}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Z: <span className="text-slate-800">{from || '—'}</span>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500">Do</label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="adres@klienta.pl"
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Temat</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Temat wiadomości"
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Treść</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Dzień dobry,&#10;&#10;…&#10;&#10;Pozdrawiam,&#10;Zespół Krainy Herbaty"
              className="mt-1 text-sm leading-relaxed"
            />
          </div>
        </div>
        <DialogFooter>
          <p className="text-[11px] text-slate-400 mr-auto self-center">
            Utworzy szkic — załączniki dodasz i wyślesz w wątku.
          </p>
          <Button
            onClick={onSubmit}
            disabled={pending || !from || !to.trim() || !subject.trim() || !body.trim()}
          >
            {pending ? 'Tworzę…' : 'Dalej →'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
