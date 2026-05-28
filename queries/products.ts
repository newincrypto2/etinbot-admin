import { prisma } from '@/lib/prisma'

export type ProductVariant = {
  label: string | null
  pricePln: number | null
  salePricePln: number | null
  stockStatus: string | null
  stockQty: number | null
  url: string | null
}

export type ProductRow = {
  id: string
  extId: string
  name: string | null
  pricePln: number | null
  salePricePln: number | null
  stockStatus: string | null
  stockQty: number | null
  categories: string[]
  imageUrl: string | null
  shortDescription: string | null
  url: string | null
  productType: string | null
  variants: ProductVariant[]
  attributes: Record<string, string>
  lastSyncedAt: Date | null
}

function parseAttributes(raw: unknown): Record<string, string> {
  let obj: unknown = raw
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) } catch { return {} }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v == null) continue
    out[k] = String(v)
  }
  return out
}

/** Znajduje wartość atrybutu po częściowym dopasowaniu klucza (case-insensitive). */
export function findAttr(attrs: Record<string, string>, ...needles: string[]): string | null {
  const entries = Object.entries(attrs)
  for (const needle of needles) {
    const n = needle.toLowerCase()
    const hit = entries.find(([k]) => k.toLowerCase().includes(n))
    if (hit && hit[1]) return hit[1]
  }
  return null
}

function parseVariants(raw: unknown): ProductVariant[] {
  let arr: unknown = raw
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr) } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return arr.flatMap((v) => {
    if (!v || typeof v !== 'object') return []
    const o = v as Record<string, unknown>
    return [{
      label: typeof o.label === 'string' ? o.label : null,
      pricePln: o.price_pln != null ? Number(o.price_pln) : null,
      salePricePln: o.sale_price_pln != null ? Number(o.sale_price_pln) : null,
      stockStatus: typeof o.stock_status === 'string' ? o.stock_status : null,
      stockQty: o.stock_qty != null ? Number(o.stock_qty) : null,
      url: typeof o.url === 'string' ? o.url : null,
    }]
  })
}

export type ProductStats = {
  total: number
  inStock: number
  outOfStock: number
  onBackorder: number
}

async function clientIdBySlug(slug: string): Promise<string | null> {
  const c = await prisma.clients.findUnique({ where: { slug }, select: { id: true } })
  return c?.id ?? null
}

/** Statystyki liczone po CAŁEJ bazie (groupBy), nie po wyświetlanej stronie. */
export async function getProductStats(clientSlug: string): Promise<ProductStats> {
  const clientId = await clientIdBySlug(clientSlug)
  if (!clientId) return { total: 0, inStock: 0, outOfStock: 0, onBackorder: 0 }

  const groups = await prisma.products.groupBy({
    by: ['stock_status'],
    where: { client_id: clientId, is_active: true },
    _count: { _all: true },
  })

  let inStock = 0
  let outOfStock = 0
  let onBackorder = 0
  let total = 0
  for (const g of groups) {
    const c = g._count._all
    total += c
    if (g.stock_status === 'outofstock') outOfStock += c
    else if (g.stock_status === 'onbackorder') onBackorder += c
    else inStock += c
  }
  return { total, inStock, outOfStock, onBackorder }
}

export type ListProductsResult = {
  rows: ProductRow[]
  total: number       // ile pasuje do filtra (do paginacji)
  page: number
  pageSize: number
}

export async function listProducts(opts: {
  clientSlug: string
  search?: string
  stock?: string      // 'all' | 'instock' | 'outofstock' | 'onbackorder'
  page?: number
  pageSize?: number
}): Promise<ListProductsResult> {
  const pageSize = opts.pageSize ?? 50
  const page = Math.max(1, opts.page ?? 1)
  const clientId = await clientIdBySlug(opts.clientSlug)
  if (!clientId) return { rows: [], total: 0, page, pageSize }

  const where: any = { client_id: clientId, is_active: true }
  if (opts.search) {
    where.OR = [
      { name: { contains: opts.search, mode: 'insensitive' } },
      { sku: { contains: opts.search, mode: 'insensitive' } },
      { ext_id: { contains: opts.search } },
    ]
  }
  if (opts.stock && opts.stock !== 'all') {
    where.stock_status = opts.stock
  }

  const [rows, total] = await Promise.all([
    prisma.products.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        ext_id: true,
        name: true,
        price_pln: true,
        sale_price_pln: true,
        stock_status: true,
        stock_qty: true,
        categories: true,
        image_url: true,
        short_description: true,
        url: true,
        product_type: true,
        variants: true,
        attributes: true,
        last_synced_at: true,
      },
    }),
    prisma.products.count({ where }),
  ])

  return {
    rows: rows.map((r) => ({
      id: String(r.id),
      extId: r.ext_id,
      name: r.name,
      pricePln: r.price_pln ? Number(r.price_pln) : null,
      salePricePln: r.sale_price_pln ? Number(r.sale_price_pln) : null,
      stockStatus: r.stock_status,
      stockQty: r.stock_qty,
      categories: r.categories ?? [],
      imageUrl: r.image_url,
      shortDescription: r.short_description,
      url: r.url,
      productType: r.product_type,
      variants: parseVariants(r.variants),
      attributes: parseAttributes(r.attributes),
      lastSyncedAt: r.last_synced_at,
    })),
    total,
    page,
    pageSize,
  }
}
