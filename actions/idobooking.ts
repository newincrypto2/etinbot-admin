'use server'

import { revalidatePath } from 'next/cache'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { callBackend, callBackendGet } from '@/lib/backend'

// UI danych dostępowych IdoBooking (vertical=rental). Endpointy backendu:
//   GET  /api/admin/idobooking-credentials?slug=   → lista scope'ów (bez haseł)
//   POST /api/admin/idobooking-credentials         → {slug, scope, tenant, system_login, api_password}
// (endpointy buduje równolegle agent backendu — mapowanie pól defensywne)

export type IdoCredential = {
  scope: string
  tenant: string
  systemLogin: string
  apiVersion: number | null
  apiLang: string | null
  isActive: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export type ListIdoResult = { ok: boolean; items: IdoCredential[]; message?: string }
export type SaveResult = { ok: boolean; message: string }

function s(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapCredential(c: any): IdoCredential {
  return {
    scope: String(c.scope ?? ''),
    tenant: String(c.tenant ?? ''),
    systemLogin: String(c.system_login ?? c.systemLogin ?? ''),
    apiVersion: typeof c.api_version === 'number' ? c.api_version : null,
    apiLang: typeof c.api_lang === 'string' ? c.api_lang : null,
    isActive: c.is_active !== false,
    lastSyncAt: (c.last_sync_at as string) ?? null,
    lastError: (c.last_error as string) ?? null,
  }
}

export async function listIdoBookingCredentials(slug: string): Promise<ListIdoResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, items: [], message: guard.message }

  const r = await callBackendGet(`/api/admin/idobooking-credentials?slug=${encodeURIComponent(slug)}`)
  if (!r.ok) {
    return { ok: false, items: [], message: `Nie udało się pobrać danych IdoBooking (${r.status}). ${r.text.slice(0, 140)}` }
  }
  const raw = Array.isArray(r.data.credentials)
    ? (r.data.credentials as any[])
    : Array.isArray(r.data.items)
      ? (r.data.items as any[])
      : Array.isArray(r.data)
        ? (r.data as unknown as any[])
        : []
  return { ok: true, items: raw.map(mapCredential) }
}

export async function saveIdoBookingCredential(slug: string, fd: FormData): Promise<SaveResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }

  const scope = s(fd, 'scope')
  const tenant = s(fd, 'tenant')
  const login = s(fd, 'system_login')
  const pass = s(fd, 'api_password')

  if (!scope) return { ok: false, message: 'Podaj scope (np. „default" lub kod budynku).' }
  if (!tenant) return { ok: false, message: 'Podaj identyfikator tenanta IdoBooking.' }
  if (!login) return { ok: false, message: 'Podaj login systemowy IdoBooking.' }

  const body: Record<string, unknown> = { slug, scope, tenant, system_login: login }
  // Puste hasło = bez zmiany (nie nadpisujemy istniejącego przy edycji).
  if (pass) body.api_password = pass

  const r = await callBackend('/api/admin/idobooking-credentials', body)
  if (!r.ok) {
    return { ok: false, message: `Nie udało się zapisać (${r.status}). ${r.text.slice(0, 140)}` }
  }
  revalidatePath(`/clients/${slug}`)
  return { ok: true, message: 'Zapisano dane dostępowe IdoBooking.' }
}
