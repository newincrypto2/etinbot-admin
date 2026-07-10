'use server'

import { revalidatePath } from 'next/cache'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { callBackend } from '@/lib/backend'

// ─── Twarde kasowanie tenanta (off-boarding) ────────────────────────────────

export type DeleteTenantResult =
  | { ok: true; deleted: Record<string, number>; adminUsersDetached: number }
  | { ok: false; message: string }

/**
 * Usuwa tenanta i wszystkie jego dane (nieodwracalne). Backend pilnuje
 * bezpieczników (tenant nieaktywny, confirm == "USUŃ {slug}", nie-domyślny slug).
 * Panel dodatkowo wymaga SUPERADMIN.
 */
export async function deleteTenant(slug: string, confirm: string): Promise<DeleteTenantResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }

  const s = (slug || '').trim()
  if (!s) return { ok: false, message: 'Brak slug tenanta.' }

  const r = await callBackend('/api/admin/delete-tenant', { slug: s, confirm })
  if (!r.ok) {
    const detail = (r.data.detail as string) || r.text.slice(0, 200) || `HTTP ${r.status}`
    return { ok: false, message: detail }
  }

  revalidatePath('/clients')
  return {
    ok: true,
    deleted: (r.data.deleted as Record<string, number>) ?? {},
    adminUsersDetached: Number(r.data.admin_users_detached ?? 0),
  }
}
