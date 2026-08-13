'use client'

import { useMemo, useState, useTransition } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { updateUserPermissions } from '@/actions/users'
import type { PermissionKey } from '@/lib/permissions'

export type PermissionGroup = { title: string; keys: string[] }

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  userId: string
  userName: string
  role: string
  /** Jawne nadpisania usera (permissions jsonb, sparsowane po stronie serwera). */
  overrides: Partial<Record<string, boolean>>
  groups: PermissionGroup[]
  labels: Record<string, string>
  /** Klucze true w presecie aktualnej roli usera. */
  roleDefaults: string[]
  onSaved?: () => void
}

/**
 * Edytor uprawnień szczegółowych — checkboxy per moduł, stan domyślny =
 * preset roli. Kliknięcie checkboxa tworzy jawny override TYLKO gdy wynik
 * różni się od presetu roli; powrót do wartości z presetu usuwa override
 * (znów "z roli"). „Przywróć domyślne z roli" czyści wszystkie override'y.
 */
export function PermissionsDialog({
  open, onOpenChange, userId, userName, role, overrides, groups, labels, roleDefaults, onSaved,
}: Props) {
  const defaultSet = useMemo(() => new Set(roleDefaults), [roleDefaults])
  // Kluczami są zawsze PermissionKey (przychodzą z lib/permissions.ts po
  // stronie serwera) — luźniejszy typ string tutaj tylko po to, żeby
  // group.keys (string[], plain prop) nie wymagało rzutowań przy każdym użyciu.
  const [local, setLocal] = useState<Partial<Record<string, boolean>>>(overrides)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Re-inicjalizacja stanu przy każdym otwarciu (dialog nie odmontowuje się między otwarciami).
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setLocal(overrides)
      setError(null)
      setSavedMsg(null)
    }
  }

  function effective(key: string): boolean {
    if (key in local) return local[key]!
    return defaultSet.has(key)
  }

  function isOverridden(key: string): boolean {
    return key in local && local[key] !== defaultSet.has(key)
  }

  function toggle(key: string) {
    const next = !effective(key)
    setLocal((prev) => {
      const copy = { ...prev }
      if (next === defaultSet.has(key)) {
        // Wraca do wartości presetu → usuń override, znów "z roli".
        delete copy[key]
      } else {
        copy[key] = next
      }
      return copy
    })
  }

  function resetToRoleDefaults() {
    setLocal({})
  }

  function save() {
    setError(null)
    setSavedMsg(null)
    startTransition(async () => {
      const hasOverrides = Object.keys(local).length > 0
      const res = await updateUserPermissions(
        userId,
        hasOverrides ? (local as Partial<Record<PermissionKey, boolean>>) : null,
      )
      if (res.ok) {
        setSavedMsg(res.message ?? 'Zapisano')
        onSaved?.()
        setTimeout(() => onOpenChange(false), 900)
      } else {
        setError(res.message ?? 'Błąd zapisu')
      }
    })
  }

  const overrideCount = Object.keys(local).filter((k) => isOverridden(k)).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uprawnienia szczegółowe — {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-xs text-slate-500">
            Domyślnie uprawnienia wynikają z roli (<strong>{role}</strong>). Odznacz lub zaznacz
            pole, żeby nadpisać pojedyncze uprawnienie tylko dla tego użytkownika — nadpisane
            pola są podświetlone i oznaczone „nadpisane&rdquo;.
          </p>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {savedMsg && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {savedMsg}
            </div>
          )}

          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.title} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  {group.title}
                </div>
                <div className="space-y-1.5">
                  {group.keys.map((key) => {
                    const checked = effective(key)
                    const overridden = isOverridden(key)
                    return (
                      <label
                        key={key}
                        className={`flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm cursor-pointer ${
                          overridden ? 'bg-amber-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(key)}
                            disabled={pending}
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="truncate">{labels[key] ?? key}</span>
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${
                            overridden
                              ? 'text-amber-700 border-amber-300 bg-amber-100'
                              : 'text-slate-400 border-slate-200'
                          }`}
                        >
                          {overridden ? 'nadpisane' : 'z roli'}
                        </Badge>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={resetToRoleDefaults}
            disabled={pending || overrideCount === 0}
            className="text-slate-500"
          >
            Przywróć domyślne z roli
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Anuluj
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
