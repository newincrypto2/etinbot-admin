'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'

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
import { deleteApartment } from '@/actions/apartments'

type Props = {
  id: string
  name: string
}

export function ApartmentRowActions({ id, name }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteApartment(id)
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
        title="Edytuj"
        onClick={() => router.push(`/apartments/${id}/edit`)}
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
            <AlertDialogTitle>Usunąć ten apartament?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-700">„{name}"</span>
              <br /><br />
              Wszystkie rezerwacje i konwersacje powiązane z tym apartamentem zostaną odwiązane.
              Operacja nieodwracalna.
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
