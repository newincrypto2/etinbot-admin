'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings, Loader2 } from 'lucide-react'

import { setActiveTenant } from '@/actions/tenant'

export function SwitchAndSettingsLink({ slug }: { slug: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setActiveTenant(slug)
          if (r.ok) {
            router.push('/settings/integrations')
          } else {
            toast.error(r.message)
          }
        })
      }
      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
      Przełącz i edytuj integracje
    </button>
  )
}
