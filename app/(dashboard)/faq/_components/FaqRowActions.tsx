'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Power } from 'lucide-react'

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
import { deleteFaq, toggleFaqActive } from '@/actions/faq'

type Props = {
  id: string
  isActive: boolean
  question: string
}

export function FaqRowActions({ id, isActive, question }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const onToggle = () => {
    startTransition(async () => { await toggleFaqActive(id) })
  }

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteFaq(id)
      if (res.ok) {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <Button
        size="icon"
        variant="ghost"
        title={isActive ? 'Wyłącz' : 'Włącz'}
        onClick={onToggle}
        disabled={pending}
        className={isActive ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-slate-600'}
      >
        <Power className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        title="Edytuj"
        onClick={() => router.push(`/faq/${id}/edit`)}
        disabled={pending}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        title="Usuń"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="text-red-500 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć ten wpis FAQ?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-700">„{question}"</span>
              <br /><br />
              Operacja nieodwracalna. Bot przestanie używać tej odpowiedzi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={pending}
              className="bg-red-600 hover:bg-red-700"
            >
              {pending ? 'Usuwanie...' : 'Usuń'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
