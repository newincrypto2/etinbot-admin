'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Plus, KeyRound, Pencil } from 'lucide-react'

import { saveIdoBookingCredential, type IdoCredential } from '@/actions/idobooking'

const inputCls =
  'w-full h-9 px-3 rounded-md border border-slate-300 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200'

function fmtIso(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })
}

export function IdoBookingCreds({
  slug,
  initial,
  loadError,
}: {
  slug: string
  initial: IdoCredential[]
  loadError?: string
}) {
  const [pending, startTransition] = useTransition()
  // Formularz add/edit — edycja prefilluje scope/tenant/login (bez hasła).
  const [form, setForm] = useState({ scope: '', tenant: '', system_login: '', api_password: '' })
  const [editing, setEditing] = useState<string | null>(null)

  const startEdit = (c: IdoCredential) => {
    setEditing(c.scope)
    setForm({ scope: c.scope, tenant: c.tenant, system_login: c.systemLogin, api_password: '' })
  }
  const reset = () => {
    setEditing(null)
    setForm({ scope: '', tenant: '', system_login: '', api_password: '' })
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData()
    fd.set('scope', form.scope)
    fd.set('tenant', form.tenant)
    fd.set('system_login', form.system_login)
    fd.set('api_password', form.api_password)
    startTransition(async () => {
      const r = await saveIdoBookingCredential(slug, fd)
      if (r.ok) {
        toast.success(r.message)
        reset()
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <div className="bg-white border rounded-lg p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
          <KeyRound className="h-4 w-4 text-indigo-500" /> IdoBooking (rental)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Dane dostępowe do API IdoBooking per scope (np. budynek / konto). Hasło API jest szyfrowane po stronie backendu.
        </p>
      </div>

      {loadError && (
        <div className="text-xs rounded-md px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200">
          {loadError}
        </div>
      )}

      {/* Lista scope'ów */}
      {initial.length > 0 ? (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Scope</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Tenant</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Login</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Ostatni sync</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initial.map((c) => (
                <tr key={c.scope} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">{c.scope}</td>
                  <td className="px-3 py-2 text-slate-700">{c.tenant}</td>
                  <td className="px-3 py-2 text-slate-600">{c.systemLogin}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {fmtIso(c.lastSyncAt)}
                    {c.lastError && <div className="text-red-500 truncate max-w-[180px]" title={c.lastError}>{c.lastError}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {c.isActive
                      ? <span className="text-xs text-emerald-600">aktywne</span>
                      : <span className="text-xs text-slate-400">wyłączone</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" /> Edytuj
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loadError && <p className="text-xs text-slate-400">Brak zapisanych scope'ów — dodaj pierwszy poniżej.</p>
      )}

      {/* Formularz add/edit */}
      <form onSubmit={submit} className="space-y-3 pt-2 border-t border-slate-100">
        <div className="text-xs font-medium text-slate-600">
          {editing ? `Edycja scope „${editing}"` : 'Nowy scope'}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 block mb-1">Scope *</span>
            <input
              className={inputCls}
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
              placeholder="default"
              readOnly={!!editing}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 block mb-1">Tenant IdoBooking *</span>
            <input
              className={inputCls}
              value={form.tenant}
              onChange={(e) => setForm((f) => ({ ...f, tenant: e.target.value }))}
              placeholder="np. silverplace"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 block mb-1">Login systemowy *</span>
            <input
              className={inputCls}
              value={form.system_login}
              onChange={(e) => setForm((f) => ({ ...f, system_login: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 block mb-1">Hasło API {editing && <span className="text-slate-400">(puste = bez zmiany)</span>}</span>
            <input
              className={inputCls}
              type="password"
              value={form.api_password}
              onChange={(e) => setForm((f) => ({ ...f, api_password: e.target.value }))}
              autoComplete="new-password"
              placeholder={editing ? '••••••••' : ''}
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? 'Zapisz zmiany' : 'Dodaj scope'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="h-9 px-4 inline-flex items-center rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Anuluj
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
