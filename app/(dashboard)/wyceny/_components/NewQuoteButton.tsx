'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
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
import { createQuote } from '@/actions/quotes'

export function NewQuoteButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [personalization, setPersonalization] = useState('')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerCompany, setCustomerCompany] = useState('')

  const onSubmit = () =>
    startTransition(async () => {
      const qty = quantity.trim() ? parseInt(quantity, 10) : undefined
      if (quantity.trim() && (!Number.isFinite(qty) || (qty as number) <= 0)) {
        toast.error('Ilość musi być liczbą większą od zera.')
        return
      }
      const r = await createQuote({
        product,
        quantity: qty,
        personalization,
        deadline,
        notes,
        customerName,
        customerEmail,
        customerPhone,
        customerCompany,
      })
      if (r.ok && r.quoteId) {
        toast.success(r.message)
        setOpen(false)
        router.push(`/wyceny/${r.quoteId}`)
      } else if (r.ok) {
        toast.success(r.message)
        setOpen(false)
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })

  return (
    <>
      <Button className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nowa wycena
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nowa wycena (ręczna)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Produkt / przedmiot wyceny *">
              <Textarea
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                rows={2}
                placeholder="np. Bomby herbaciane z logo firmy, pudełko prezentowe 4 szt."
                className="mt-1 text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ilość (szt)">
                <Input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputMode="numeric"
                  placeholder="np. 200"
                  className="mt-1 text-sm"
                />
              </Field>
              <Field label="Termin realizacji">
                <Input
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="np. do 10 grudnia"
                  className="mt-1 text-sm"
                />
              </Field>
            </div>
            <Field label="Personalizacja">
              <Input
                value={personalization}
                onChange={(e) => setPersonalization(e.target.value)}
                placeholder="np. wstążka z logo, bilecik z życzeniami"
                className="mt-1 text-sm"
              />
            </Field>
            <Field label="Uwagi">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Dodatkowe informacje do kalkulacji"
                className="mt-1 text-sm"
              />
            </Field>
            <div className="pt-1 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mt-2">Dane klienta (opcjonalne)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Imię i nazwisko">
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 text-sm" />
              </Field>
              <Field label="Firma">
                <Input
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  className="mt-1 text-sm"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail">
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  type="email"
                  placeholder="adres@firmy.pl"
                  className="mt-1 text-sm"
                />
              </Field>
              <Field label="Telefon">
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1 text-sm" />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <p className="text-[11px] text-slate-400 mr-auto self-center">
              Po utworzeniu ruszy analiza LLM (~10–30 s).
            </p>
            <Button onClick={onSubmit} disabled={pending || !product.trim()}>
              {pending ? 'Tworzę…' : 'Utwórz wycenę'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      {children}
    </div>
  )
}
