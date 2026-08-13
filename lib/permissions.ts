import { redirect } from 'next/navigation'

import { getFreshSessionUser, type AppRole } from '@/lib/auth-helpers'

// ============================================================
// Granularne uprawnienia — rola = preset, per-user override w DB
// ============================================================
// Rola (SUPERADMIN/OWNER/EDITOR/VIEWER) dalej istnieje i steruje domyślnym
// zestawem uprawnień (ROLE_DEFAULTS). Admin (users.manage) może dla
// pojedynczego usera nadpisać wybrane klucze w kolumnie `permissions`
// (jsonb {key: boolean}) — nadpisanie zawsze wygrywa nad presetem roli.
//
// WAŻNE: ROLE_DEFAULTS odwzorowuje 1:1 guardy sprzed wprowadzenia tego
// systemu (assertRoleOrFail/requireRole per moduł) — dzień wdrożenia = zero
// zmiany zachowania dla usera bez override'ów. Zmiana ROLE_DEFAULTS zmienia
// domyślne uprawnienia WSZYSTKICH userów danej roli — rób to świadomie.

export const PERMISSION_KEYS = [
  'dashboard.view',
  'mail.view', 'mail.send',
  'conversations.view', 'conversations.manage',
  'escalations.view', 'escalations.manage',
  'products.view', 'products.manage',
  'orders.view', 'orders.manage',
  'reship.view',
  'returns.view',
  'quotes.view', 'quotes.manage',
  'promobar.view', 'promobar.manage',
  'faq.view', 'faq.manage', 'faq.review_candidates',
  'billing.view', 'billing.export',
  'apartments.view', 'apartments.manage',
  'reservations.view',
  'clients.manage',
  'users.manage',
  'settings.manage',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS)

export function isPermissionKey(v: unknown): v is PermissionKey {
  return typeof v === 'string' && PERMISSION_KEY_SET.has(v)
}

// ─── Grupy modułów — do UI edytora uprawnień (PermissionsEditor) ───────────

export const PERMISSION_GROUPS: { title: string; keys: PermissionKey[] }[] = [
  { title: 'Dashboard', keys: ['dashboard.view'] },
  { title: 'Poczta', keys: ['mail.view', 'mail.send'] },
  { title: 'Konwersacje', keys: ['conversations.view', 'conversations.manage'] },
  { title: 'Eskalacje', keys: ['escalations.view', 'escalations.manage'] },
  { title: 'Produkty', keys: ['products.view', 'products.manage'] },
  { title: 'Zamówienia', keys: ['orders.view', 'orders.manage'] },
  { title: 'Dosyłki', keys: ['reship.view'] },
  { title: 'Zwroty', keys: ['returns.view'] },
  { title: 'Wyceny', keys: ['quotes.view', 'quotes.manage'] },
  { title: 'Pasek promo', keys: ['promobar.view', 'promobar.manage'] },
  { title: 'FAQ', keys: ['faq.view', 'faq.manage'] },
  { title: 'Nauka FAQ', keys: ['faq.review_candidates'] },
  { title: 'Apartamenty', keys: ['apartments.view', 'apartments.manage'] },
  { title: 'Rezerwacje', keys: ['reservations.view'] },
  { title: 'Koszty', keys: ['billing.view', 'billing.export'] },
  { title: 'Klienci (tenanci)', keys: ['clients.manage'] },
  { title: 'Użytkownicy', keys: ['users.manage'] },
  { title: 'Ustawienia', keys: ['settings.manage'] },
]

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.view': 'Podgląd dashboardu',
  'mail.view': 'Podgląd poczty',
  'mail.send': 'Wysyłanie / obsługa poczty',
  'conversations.view': 'Podgląd konwersacji',
  'conversations.manage': 'Obsługa konwersacji (przejęcie, odpowiedzi)',
  'escalations.view': 'Podgląd eskalacji',
  'escalations.manage': 'Obsługa eskalacji (rozwiąż, akceptuj jako FAQ)',
  'products.view': 'Podgląd produktów',
  'products.manage': 'Synchronizacja produktów',
  'orders.view': 'Podgląd zamówień',
  'orders.manage': 'Synchronizacja zamówień',
  'reship.view': 'Podgląd dosyłek',
  'returns.view': 'Podgląd zwrotów',
  'quotes.view': 'Podgląd wycen',
  'quotes.manage': 'Edycja wycen',
  'promobar.view': 'Podgląd paska promo',
  'promobar.manage': 'Edycja paska promo',
  'faq.view': 'Podgląd FAQ',
  'faq.manage': 'Edycja FAQ i dokumentów',
  'faq.review_candidates': 'Przegląd kandydatów (Nauka FAQ)',
  'billing.view': 'Podgląd kosztów',
  'billing.export': 'Eksport kosztów (CSV)',
  'apartments.view': 'Podgląd apartamentów',
  'apartments.manage': 'Edycja apartamentów',
  'reservations.view': 'Podgląd rezerwacji',
  'clients.manage': 'Zarządzanie klientami (tenantami)',
  'users.manage': 'Zarządzanie użytkownikami panelu',
  'settings.manage': 'Ustawienia (brand/eskalacja/integracje/odbiorcy)',
}

// ─── Presety per rola ────────────────────────────────────────────────────

const ALL_VIEW_KEYS: PermissionKey[] = [
  'dashboard.view', 'mail.view', 'conversations.view', 'escalations.view',
  'products.view', 'orders.view', 'reship.view', 'returns.view',
  'quotes.view', 'promobar.view', 'faq.view', 'apartments.view',
  'reservations.view',
]

const OPERATIONAL_MANAGE_KEYS: PermissionKey[] = [
  'mail.send', 'conversations.manage', 'escalations.manage',
  'products.manage', 'orders.manage', 'quotes.manage', 'promobar.manage',
  'faq.manage', 'faq.review_candidates', 'apartments.manage',
]

function toSet(keys: PermissionKey[]): Set<PermissionKey> {
  return new Set(keys)
}

export const ROLE_DEFAULTS: Record<AppRole, Set<PermissionKey>> = {
  // VIEWER — podgląd wszędzie oprócz kosztów (billing = dane finansowe/marże).
  VIEWER: toSet(ALL_VIEW_KEYS),
  // EDITOR — podgląd + edycja modułów operacyjnych. Bez billing.*, bez
  // users.manage/settings.manage/clients.manage.
  EDITOR: toSet([...ALL_VIEW_KEYS, ...OPERATIONAL_MANAGE_KEYS]),
  // OWNER — wszystko poza clients.manage (zarządzanie tenantami = SUPERADMIN).
  OWNER: toSet(PERMISSION_KEYS.filter((k) => k !== 'clients.manage')),
  // SUPERADMIN — wszystko.
  SUPERADMIN: toSet([...PERMISSION_KEYS]),
}

// ─── Efektywne uprawnienia (preset roli + override) ─────────────────────

export type UserPermissionsInput = {
  role: string | null | undefined
  permissions?: unknown
}

/** Parsuje kolumnę `permissions` (jsonb) do Partial<Record<PermissionKey, boolean>>. */
export function parseOverrides(raw: unknown): Partial<Record<PermissionKey, boolean>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Partial<Record<PermissionKey, boolean>> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isPermissionKey(k) && typeof v === 'boolean') out[k] = v
  }
  return out
}

/** Override (jeśli klucz obecny w permissions) wygrywa nad presetem roli. */
export function hasPermission(user: UserPermissionsInput, key: PermissionKey): boolean {
  const overrides = parseOverrides(user.permissions)
  if (key in overrides) return overrides[key]!
  const role = user.role && user.role in ROLE_DEFAULTS ? (user.role as AppRole) : null
  if (!role) return false
  return ROLE_DEFAULTS[role].has(key)
}

/** Pełna efektywna mapa uprawnień (preset + override) — do UI (Sidebar, edytor). */
export function effectivePermissions(user: UserPermissionsInput): Record<PermissionKey, boolean> {
  const out = {} as Record<PermissionKey, boolean>
  for (const key of PERMISSION_KEYS) out[key] = hasPermission(user, key)
  return out
}

// ─── Server-side: pobranie świeżego usera (DB, cache() per request) ──────
// getFreshSessionUser (auth-helpers.ts) jest cache()'owane per request/akcję
// i już egzekwuje sessionVersion (sesja przeterminowana = null) — dzielimy
// to samo zapytanie z getCurrentRole(), zero dodatkowych round-tripów do DB.
export async function getCurrentPermissions(): Promise<Record<PermissionKey, boolean>> {
  const user = await getFreshSessionUser()
  if (!user) return effectivePermissions({ role: null })
  return effectivePermissions(user)
}

/** Dla stron (Server Components) — redirect na brak uprawnień. */
export async function requirePermission(key: PermissionKey) {
  const perms = await getCurrentPermissions()
  if (!perms[key]) {
    redirect('/')
  }
  return perms
}

/** Dla akcji destrukcyjnych — zwraca {ok:false} zamiast redirect. */
export async function assertPermissionOrFail(key: PermissionKey): Promise<
  | { ok: true }
  | { ok: false; message: string }
> {
  const perms = await getCurrentPermissions()
  if (!perms[key]) {
    return { ok: false, message: `Brak uprawnień (wymagane: ${key})` }
  }
  return { ok: true }
}
