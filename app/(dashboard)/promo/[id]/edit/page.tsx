import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { PromoBarForm, type PromoBarValues } from '../../_components/PromoBarForm'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

/** Date → wartość dla <input type=datetime-local> w lokalnej strefie. */
function toLocal(d: Date | null): string {
  if (!d) return ''
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export default async function EditPromoPage(props: { params: Promise<{ id: string }> }) {
  await requireAuth()
  const { id } = await props.params
  const client = await prisma.clients.findUnique({ where: { slug: CLIENT_SLUG }, select: { id: true } })
  if (!client) notFound()
  const b = await prisma.promo_bars.findFirst({ where: { id, client_id: client.id } })
  if (!b) notFound()

  const colors = (typeof b.colors === 'string' ? JSON.parse(b.colors as string) : b.colors) as Record<string, string>
  const initial: PromoBarValues = {
    id: b.id,
    name: b.name,
    text: b.text,
    cta_text: b.cta_text ?? '',
    cta_url: b.cta_url ?? '',
    coupon_code: b.coupon_code ?? '',
    timer_ends_at: toLocal(b.timer_ends_at),
    timer_finished_text: b.timer_finished_text ?? '',
    hide_after_end: b.hide_after_end,
    starts_at: toLocal(b.starts_at),
    ends_at: toLocal(b.ends_at),
    include_paths: (b.include_paths ?? []).join(', '),
    exclude_paths: (b.exclude_paths ?? []).join(', '),
    priority: b.priority,
    trigger: b.trigger,
    trigger_seconds: b.trigger_seconds,
    cooldown_hours: b.cooldown_hours,
    colors: colors ?? {},
    sizes: ((typeof b.sizes === 'string' ? JSON.parse(b.sizes as string) : b.sizes) ?? {}) as Record<string, number>,
    text_b: b.text_b ?? '',
    free_shipping_threshold: b.free_shipping_threshold ? String(b.free_shipping_threshold) : '',
    text_reached: b.text_reached ?? '',
  }

  return (
    <div className="space-y-6">
      <Link href="/promo" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Wróć do listy
      </Link>
      <h1 className="text-xl font-semibold">Edycja: {b.name}</h1>
      <PromoBarForm initial={initial} />
    </div>
  )
}
