// Server-side dostęp do modułów aktywnego tenanta.
//
// getActiveModules() — efektywny stan modułów (vertical + config.modules),
//   cache() per request; layout przekazuje wynik do Sidebara, strony używają
//   requireModule().
// requireModule(id) — guard strony modułu: wyłączony moduł = redirect('/').
//   Ukrycie linku w menu to za mało — bez guarda tenant rental wchodził
//   ręcznym URL-em na /zwroty (i odwrotnie). Wzorzec z apartments/page.tsx,
//   uogólniony na wszystkie moduły.

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { activeClient } from '@/lib/tenant'
import {
  moduleOverridesFromConfig,
  resolveModules,
  type ModuleId,
} from '@/lib/modules'

export const getActiveModules = cache(async (): Promise<Record<ModuleId, boolean>> => {
  const active = await activeClient()
  const row = await prisma.clients.findUnique({
    where: { id: active.id },
    select: { config: true },
  })
  return resolveModules(active.vertical, moduleOverridesFromConfig(row?.config))
})

/** Dla stron (Server Components) — redirect na dashboard, gdy moduł wyłączony. */
export async function requireModule(id: ModuleId): Promise<Record<ModuleId, boolean>> {
  const mods = await getActiveModules()
  if (!mods[id]) redirect('/')
  return mods
}

/** Dla akcji — zwraca {ok:false} zamiast redirectu (spójnie z assertPermissionOrFail). */
export async function assertModuleOrFail(id: ModuleId): Promise<
  | { ok: true }
  | { ok: false; message: string }
> {
  const mods = await getActiveModules()
  if (!mods[id]) {
    return { ok: false, message: `Moduł "${id}" jest wyłączony dla tego tenanta` }
  }
  return { ok: true }
}
