'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { setActiveTenant } from '@/actions/tenant'

// UWAGA (redesign panelu, 08.2026): ten selektor już nie jest renderowany w
// Headerze — zastąpiła go zakładka tenanta w sidebarze
// (components/layout/TenantTile.tsx), stylowana wg makiety Panel EtinBOT 2.0
// i osadzona pod logo. Plik zostaje w repo (nie kasujemy plików klienta) jako
// punkt odniesienia/rollback, gdyby TenantTile wymagał wycofania.
/** Selektor tenanta w Headerze — widoczny tylko dla SUPERADMIN bez przypisanego klienta. */
export function TenantSelector({
  tenants,
  active,
}: {
  tenants: { slug: string; name: string; vertical: string | null }[]
  active: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (tenants.length <= 1) return null

  return (
    <div className="inline-flex items-center gap-1.5">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
      ) : (
        <Building2 className="h-4 w-4 text-indigo-500" />
      )}
      <select
        value={active}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const r = await setActiveTenant(e.target.value)
            if (r.ok) {
              toast.success(r.message)
              router.refresh()
            } else {
              toast.error(r.message)
            }
          })
        }
        className="h-8 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-sm font-medium text-indigo-800 outline-none focus:ring-2 focus:ring-indigo-300"
        title="Aktywny klient (widok panelu)"
      >
        {tenants.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name} {t.vertical ? `(${t.vertical})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
