'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil, Trash2, KeyRound, Power } from 'lucide-react'

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  deleteUser, toggleUserActive, updateUser, resetUserPassword,
  type ActionResult,
} from '@/actions/users'

const ROLES = [
  { value: 'SUPERADMIN', label: 'Superadmin' },
  { value: 'OWNER', label: 'Operator' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'VIEWER', label: 'Viewer' },
]

type Props = {
  user: {
    id: string
    name: string
    email: string
    role: string
    isActive: boolean
  }
  isCurrentUser: boolean
}

export function UserRowActions({ user, isCurrentUser }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)

  const onToggle = () => startTransition(async () => {
    await toggleUserActive(user.id)
    router.refresh()
  })

  const onDelete = () => startTransition(async () => {
    const res = await deleteUser(user.id)
    if (res.ok) {
      setDelOpen(false)
      router.refresh()
    } else {
      alert(res.message ?? 'Błąd')
    }
  })

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        title={user.isActive ? 'Dezaktywuj' : 'Aktywuj'}
        onClick={onToggle}
        disabled={pending || isCurrentUser}
        className={user.isActive ? 'text-emerald-600' : 'text-slate-400'}
      >
        <Power className="h-4 w-4" />
      </Button>

      <Button
        size="icon-sm"
        variant="ghost"
        title="Edytuj"
        onClick={() => setEditOpen(true)}
        disabled={pending}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        size="icon-sm"
        variant="ghost"
        title="Reset hasła"
        onClick={() => setPwOpen(true)}
        disabled={pending}
        className="text-amber-600"
      >
        <KeyRound className="h-4 w-4" />
      </Button>

      <Button
        size="icon-sm"
        variant="ghost"
        title={isCurrentUser ? 'Nie możesz usunąć własnego konta' : 'Usuń'}
        onClick={() => setDelOpen(true)}
        disabled={pending || isCurrentUser}
        className="text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Edit modal */}
      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={user}
        onSaved={() => router.refresh()}
      />

      {/* Password reset modal */}
      <ResetPasswordDialog
        open={pwOpen}
        onOpenChange={setPwOpen}
        userId={user.id}
        userName={user.name}
      />

      {/* Delete confirm */}
      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć użytkownika {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Konto <strong>{user.email}</strong> zostanie trwale usunięte. Operacja nieodwracalna.
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

function EditUserDialog({ open, onOpenChange, user, onSaved }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: { id: string; name: string; role: string; isActive: boolean }
  onSaved: () => void
}) {
  const action = updateUser.bind(null, user.id)
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd)
      if (res.ok) {
        onOpenChange(false)
        onSaved()
      }
      return res
    },
    { ok: false },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj użytkownika</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 mt-2">
          {state.message && !state.ok && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          )}

          <div>
            <Label className="text-xs font-medium block mb-1">Imię i nazwisko</Label>
            <Input name="name" defaultValue={user.name} required />
          </div>

          <div>
            <Label className="text-xs font-medium block mb-1">Rola</Label>
            <select
              name="role"
              defaultValue={user.role}
              className="w-full h-9 px-3 rounded-md border border-slate-300 text-sm bg-white"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={user.isActive} className="h-4 w-4" />
            <span>Konto aktywne</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <EditSubmitBtn />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditSubmitBtn() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Zapisywanie...' : 'Zapisz'}</Button>
}

function ResetPasswordDialog({ open, onOpenChange, userId, userName }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  userId: string
  userName: string
}) {
  const action = resetUserPassword.bind(null, userId)
  const [state, formAction] = useActionState<ActionResult, FormData>(
    async (prev, fd) => {
      const res = await action(prev, fd)
      if (res.ok) {
        setTimeout(() => onOpenChange(false), 1500)
      }
      return res
    },
    { ok: false },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset hasła — {userName}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 mt-2">
          {state.message && (
            <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {state.message}
            </div>
          )}
          <div>
            <Label className="text-xs font-medium block mb-1">Nowe hasło (min. 8 znaków)</Label>
            <Input name="newPassword" type="password" required minLength={8} autoFocus />
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Przekaż nowe hasło użytkownikowi bezpiecznym kanałem (nie email). User powinien zmienić je po pierwszym logowaniu.
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <ResetSubmitBtn />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetSubmitBtn() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Resetuję...' : 'Resetuj hasło'}</Button>
}
