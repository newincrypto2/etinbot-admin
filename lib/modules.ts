// ============================================================
// Rejestr modułów panelu — jedno źródło prawdy
// ============================================================
// Zastępuje dwie zaszyte na sztywno listy menu (navItems / rentalNavItems
// w Sidebar.tsx). Z rejestru korzystają:
//   - Sidebar (widoczność pozycji menu),
//   - guardy stron (requireModule w lib/modules-server.ts),
//   - karta klienta (zakładka Moduły — przełączniki per tenant).
//
// Kontrakt danych (analogicznie do clients.config.features w backendzie):
//   clients.config.modules = { "orders": false, "quotes": false, ... }
//   - brak klucza  = domyślne ustawienie z verticala tenanta (defaultFor)
//   - moduł core   = zawsze włączony (ewentualny override ignorowany)
//   - vertical null/nieznany traktujemy jak 'ecommerce' — parytet z
//     dotychczasowym zachowaniem sidebara (KH bez override'ów widzi
//     dokładnie to samo menu co przed wprowadzeniem rejestru).
//
// clients.plan przechowuje etykietę pakietu (preset). Źródłem prawdy o
// stanie modułów jest ZAWSZE config.modules — wybór pakietu w UI zapisuje
// jawnie pełen zestaw override'ów, więc późniejsza zmiana definicji
// pakietu nie zmienia po cichu istniejących tenantów.

import type { PermissionKey } from '@/lib/permissions'

export const VERTICALS = ['ecommerce', 'rental'] as const
export type Vertical = (typeof VERTICALS)[number]

export function coerceVertical(v: string | null | undefined): Vertical {
  return v === 'rental' ? 'rental' : 'ecommerce'
}

export const MODULE_IDS = [
  'mail',
  'conversations',
  'escalations',
  'products',
  'orders',
  'reship',
  'returns_allegro',
  'quotes',
  'promobar',
  'apartments',
  'reservations',
  'faq',
  'faq_learning',
  'billing',
] as const

export type ModuleId = (typeof MODULE_IDS)[number]

const MODULE_ID_SET = new Set<string>(MODULE_IDS)

export function isModuleId(v: unknown): v is ModuleId {
  return typeof v === 'string' && MODULE_ID_SET.has(v)
}

// Grupy — kolejność sekcji w menu i w edytorze modułów.
export const MODULE_GROUP_ORDER = ['operacje', 'sprzedaz', 'rental', 'wiedza', 'platforma'] as const
export type ModuleGroup = (typeof MODULE_GROUP_ORDER)[number]

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  operacje: 'Operacje',
  sprzedaz: 'Sprzedaż',
  rental: 'Zakwaterowanie',
  wiedza: 'Wiedza',
  platforma: 'Platforma',
}

export type ModuleDef = {
  id: ModuleId
  label: string
  /** Główna ścieżka modułu (pozycja menu). Podstrony łapie prefiks. */
  href: string
  /** Nazwa ikony lucide — mapowana na komponent w Sidebarze. */
  icon: string
  /** Uprawnienie usera wymagane do zobaczenia pozycji (jak dotychczas). */
  perm: PermissionKey
  group: ModuleGroup
  /** Moduł zawsze włączony — nie da się go wyłączyć per tenant. */
  core?: boolean
  /** Verticale, dla których moduł jest domyślnie włączony (bez override'u). */
  defaultFor: Vertical[]
  /** Klucz integracji z clients.config.integrations, bez której moduł nie ma sensu. */
  integration?: 'woocommerce' | 'baselinker' | 'allegro' | 'idobooking'
  /** Krótki opis do edytora modułów w karcie klienta. */
  description: string
}

export const MODULES: ModuleDef[] = [
  // ── Operacje ──────────────────────────────────────────────
  {
    id: 'mail', label: 'Poczta', href: '/poczta', icon: 'Mail', perm: 'mail.view',
    group: 'operacje', defaultFor: ['ecommerce', 'rental'],
    description: 'Skrzynki e-mail tenanta i drafty odpowiedzi AI',
  },
  {
    id: 'conversations', label: 'Konwersacje', href: '/conversations', icon: 'MessageCircle', perm: 'conversations.view',
    group: 'operacje', core: true, defaultFor: ['ecommerce', 'rental'],
    description: 'Rozmowy bota na wszystkich kanałach, przejęcia przez człowieka',
  },
  {
    id: 'escalations', label: 'Eskalacje', href: '/escalations', icon: 'AlertTriangle', perm: 'escalations.view',
    group: 'operacje', core: true, defaultFor: ['ecommerce', 'rental'],
    description: 'Sprawy przekazane człowiekowi (SMS/e-mail do odbiorców eskalacji)',
  },
  // ── Sprzedaż (e-commerce) ─────────────────────────────────
  {
    id: 'products', label: 'Produkty', href: '/products', icon: 'Package', perm: 'products.view',
    group: 'sprzedaz', defaultFor: ['ecommerce'], integration: 'woocommerce',
    description: 'Katalog produktów, z którego bot odpowiada i poleca',
  },
  {
    id: 'orders', label: 'Zamówienia', href: '/orders', icon: 'ShoppingCart', perm: 'orders.view',
    group: 'sprzedaz', defaultFor: ['ecommerce'], integration: 'baselinker',
    description: 'Status zamówień i przesyłek dostępny w rozmowie z botem',
  },
  {
    id: 'reship', label: 'Dosyłki', href: '/reship', icon: 'PackagePlus', perm: 'reship.view',
    group: 'sprzedaz', defaultFor: ['ecommerce'], integration: 'baselinker',
    description: 'Uszkodzenia i braki w paczkach, wysyłka ponowna',
  },
  {
    id: 'returns_allegro', label: 'Zwroty Allegro', href: '/zwroty', icon: 'Undo2', perm: 'returns.view',
    group: 'sprzedaz', defaultFor: ['ecommerce'], integration: 'allegro',
    description: 'Obsługa zwrotów i dyskusji z Allegro',
  },
  {
    id: 'quotes', label: 'Wyceny', href: '/wyceny', icon: 'Calculator', perm: 'quotes.view',
    group: 'sprzedaz', defaultFor: ['ecommerce'],
    description: 'Zapytania hurtowe B2B i cennik wycen',
  },
  {
    id: 'promobar', label: 'Pasek promo', href: '/promo', icon: 'Megaphone', perm: 'promobar.view',
    group: 'sprzedaz', defaultFor: ['ecommerce'],
    description: 'Pasek ogłoszeń osadzany na stronie sklepu',
  },
  // ── Zakwaterowanie (rental) ───────────────────────────────
  {
    id: 'apartments', label: 'Apartamenty', href: '/apartments', icon: 'BedDouble', perm: 'apartments.view',
    group: 'rental', defaultFor: ['rental'], integration: 'idobooking',
    description: 'Obiekty i ich opisy, z których korzysta bot',
  },
  {
    id: 'reservations', label: 'Rezerwacje', href: '/reservations', icon: 'CalendarCheck', perm: 'reservations.view',
    group: 'rental', defaultFor: ['rental'], integration: 'idobooking',
    description: 'Pobyty, przyjazdy i kody dostępu gości',
  },
  // ── Wiedza ────────────────────────────────────────────────
  {
    id: 'faq', label: 'FAQ', href: '/faq', icon: 'HelpCircle', perm: 'faq.view',
    group: 'wiedza', core: true, defaultFor: ['ecommerce', 'rental'],
    description: 'Baza wiedzy bota (FAQ + dokumenty)',
  },
  {
    id: 'faq_learning', label: 'Nauka FAQ', href: '/faq-nauka', icon: 'GraduationCap', perm: 'faq.view',
    group: 'wiedza', defaultFor: ['ecommerce', 'rental'],
    description: 'Kandydaci na FAQ wyłapani z realnych rozmów',
  },
  // ── Platforma ─────────────────────────────────────────────
  {
    id: 'billing', label: 'Koszty', href: '/billing', icon: 'Coins', perm: 'billing.view',
    group: 'platforma', core: true, defaultFor: ['ecommerce', 'rental'],
    description: 'Ledger kosztów dostawców (LLM, voice, SMS) per rozmowa',
  },
]

export const MODULES_BY_ID: Record<ModuleId, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.id, m])
) as Record<ModuleId, ModuleDef>

// ─── Override'y z clients.config.modules ───────────────────────────────

export type ModuleOverrides = Partial<Record<ModuleId, boolean>>

/** Parsuje config.modules (jsonb) — ignoruje nieznane klucze i nie-boole. */
export function parseModuleOverrides(raw: unknown): ModuleOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ModuleOverrides = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isModuleId(k) && typeof v === 'boolean') out[k] = v
  }
  return out
}

/** Wyciąga override'y modułów z całego clients.config.
 *
 * UWAGA: config z Prismy (adapter-pg) potrafi przyjść jako STRING z JSON-em,
 * nie obiekt — dokładnie dlatego queries/clients.ts ma coerceObj(). Bez
 * parsowania stringa helper po cichu zwracał {} i moduły spadały na domyślki
 * verticala (bug złapany na prod 16.08.2026: etin-produkty widział pełne
 * menu e-commerce mimo poprawnego config.modules w bazie). */
export function moduleOverridesFromConfig(config: unknown): ModuleOverrides {
  let cfg: unknown = config
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg)
    } catch {
      return {}
    }
  }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return {}
  return parseModuleOverrides((cfg as Record<string, unknown>).modules)
}

/**
 * Efektywny stan modułów tenanta: core → zawsze true; override (jeśli jest)
 * wygrywa nad domyślką verticala; brak override'u → defaultFor.
 */
export function resolveModules(
  vertical: string | null | undefined,
  overrides: ModuleOverrides
): Record<ModuleId, boolean> {
  const v = coerceVertical(vertical)
  const out = {} as Record<ModuleId, boolean>
  for (const m of MODULES) {
    if (m.core) out[m.id] = true
    else out[m.id] = overrides[m.id] ?? m.defaultFor.includes(v)
  }
  return out
}

// ─── Pakiety (presety) ─────────────────────────────────────────────────
// Wybór pakietu w UI zapisuje PEŁNY zestaw override'ów do config.modules
// oraz etykietę do clients.plan. Dzięki temu stan tenanta jest jawny i
// nie zależy od późniejszych zmian definicji pakietu.

export type ModulePlan = {
  /** Wartość zapisywana w clients.plan */
  id: string
  label: string
  description: string
  /** Pełny zestaw override'ów (moduły core pomijamy — i tak zawsze włączone). */
  modules: ModuleOverrides
}

const nonCore = (ids: ModuleId[]): ModuleOverrides => {
  const out: ModuleOverrides = {}
  for (const m of MODULES) {
    if (!m.core) out[m.id] = ids.includes(m.id)
  }
  return out
}

export const MODULE_PLANS: ModulePlan[] = [
  {
    id: 'ecommerce-full',
    label: 'E-commerce pełny',
    description: 'Sklep z pełną obsługą: zamówienia, dosyłki, zwroty Allegro, wyceny B2B, pasek promo.',
    modules: nonCore(['mail', 'faq_learning', 'products', 'orders', 'reship', 'returns_allegro', 'quotes', 'promobar']),
  },
  {
    id: 'virtual',
    label: 'Produkty wirtualne',
    description: 'Abonamenty, licencje, e-booki — bez logistyki, Allegro i wycen.',
    modules: nonCore(['mail', 'faq_learning']),
  },
  {
    id: 'rental',
    label: 'Rental',
    description: 'Najem krótkoterminowy: apartamenty i rezerwacje z IdoBooking.',
    modules: nonCore(['mail', 'faq_learning', 'apartments', 'reservations']),
  },
]

export const CUSTOM_PLAN_ID = 'custom'

/** Dopasowuje aktualny stan modułów do pakietu (albo null = zestaw własny). */
export function matchPlan(effective: Record<ModuleId, boolean>): ModulePlan | null {
  for (const plan of MODULE_PLANS) {
    const ok = MODULES.every((m) => m.core || effective[m.id] === !!plan.modules[m.id])
    if (ok) return plan
  }
  return null
}
