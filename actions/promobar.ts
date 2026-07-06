'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

export type PromoActionResult = { ok: boolean; message: string; id?: string }

const HEX = /^#?[0-9a-fA-F]{6}$/

const PromoSchema = z.object({
  name: z.string().min(2).max(120),
  text: z.string().min(2).max(300),
  text_b: z.string().max(300).optional().or(z.literal('')),
  free_shipping_threshold: z.string().optional().or(z.literal('')),
  text_reached: z.string().max(300).optional().or(z.literal('')),
  cta_text: z.string().max(60).optional().or(z.literal('')),
  cta_url: z.string().url().optional().or(z.literal('')),
  coupon_code: z.string().max(40).optional().or(z.literal('')),
  timer_ends_at: z.string().optional().or(z.literal('')),
  timer_finished_text: z.string().max(200).optional().or(z.literal('')),
  hide_after_end: z.boolean(),
  starts_at: z.string().optional().or(z.literal('')),
  ends_at: z.string().optional().or(z.literal('')),
  include_paths: z.string().optional().or(z.literal('')),
  exclude_paths: z.string().optional().or(z.literal('')),
  priority: z.coerce.number().int().min(0).max(1000),
  trigger: z.enum(['always', 'exit_intent', 'cart_idle']),
  trigger_seconds: z.coerce.number().int().min(10).max(3600),
  cooldown_hours: z.coerce.number().int().min(1).max(720),
  color_bg: z.string().regex(HEX),
  color_text: z.string().regex(HEX),
  color_cta_bg: z.string().regex(HEX),
  color_cta_text: z.string().regex(HEX),
  color_timer_bg: z.string().regex(HEX),
  color_timer_text: z.string().regex(HEX),
  size_text: z.coerce.number().int().min(10).max(40),
  size_cta: z.coerce.number().int().min(10).max(40),
  size_timer_digits: z.coerce.number().int().min(10).max(40),
  size_timer_labels: z.coerce.number().int().min(8).max(30),
})

function hex(v: string): string {
  return v.startsWith('#') ? v : `#${v}`
}

function paths(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('/') ? p : `/${p}`))
}

function dt(v: string | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

async function clientId(): Promise<string | null> {
  const c = await prisma.clients.findUnique({ where: { slug: CLIENT_SLUG }, select: { id: true } })
  return c?.id ?? null
}

function parseForm(fd: FormData) {
  return PromoSchema.safeParse({
    name: fd.get('name') ?? '',
    text: fd.get('text') ?? '',
    text_b: fd.get('text_b') ?? '',
    free_shipping_threshold: fd.get('free_shipping_threshold') ?? '',
    text_reached: fd.get('text_reached') ?? '',
    cta_text: fd.get('cta_text') ?? '',
    cta_url: fd.get('cta_url') ?? '',
    coupon_code: fd.get('coupon_code') ?? '',
    timer_ends_at: fd.get('timer_ends_at') ?? '',
    timer_finished_text: fd.get('timer_finished_text') ?? '',
    hide_after_end: fd.get('hide_after_end') === 'on',
    starts_at: fd.get('starts_at') ?? '',
    ends_at: fd.get('ends_at') ?? '',
    include_paths: fd.get('include_paths') ?? '',
    exclude_paths: fd.get('exclude_paths') ?? '',
    priority: fd.get('priority') ?? 0,
    trigger: fd.get('trigger') ?? 'always',
    trigger_seconds: fd.get('trigger_seconds') ?? 60,
    cooldown_hours: fd.get('cooldown_hours') ?? 24,
    color_bg: fd.get('color_bg') ?? '',
    color_text: fd.get('color_text') ?? '',
    color_cta_bg: fd.get('color_cta_bg') ?? '',
    color_cta_text: fd.get('color_cta_text') ?? '',
    color_timer_bg: fd.get('color_timer_bg') ?? '',
    color_timer_text: fd.get('color_timer_text') ?? '',
    size_text: fd.get('size_text') ?? 15,
    size_cta: fd.get('size_cta') ?? 13,
    size_timer_digits: fd.get('size_timer_digits') ?? 14,
    size_timer_labels: fd.get('size_timer_labels') ?? 10,
  })
}

function toData(d: z.infer<typeof PromoSchema>) {
  return {
    name: d.name,
    text: d.text,
    text_b: d.text_b || null,
    free_shipping_threshold: d.free_shipping_threshold ? parseFloat(d.free_shipping_threshold.replace(',', '.')) || null : null,
    text_reached: d.text_reached || null,
    cta_text: d.cta_text || null,
    cta_url: d.cta_url || null,
    coupon_code: d.coupon_code || null,
    timer_ends_at: dt(d.timer_ends_at),
    timer_finished_text: d.timer_finished_text || null,
    hide_after_end: d.hide_after_end,
    starts_at: dt(d.starts_at),
    ends_at: dt(d.ends_at),
    include_paths: paths(d.include_paths),
    exclude_paths: paths(d.exclude_paths),
    priority: d.priority,
    trigger: d.trigger,
    trigger_seconds: d.trigger_seconds,
    cooldown_hours: d.cooldown_hours,
    colors: {
      bg: hex(d.color_bg),
      text: hex(d.color_text),
      cta_bg: hex(d.color_cta_bg),
      cta_text: hex(d.color_cta_text),
      timer_bg: hex(d.color_timer_bg),
      timer_text: hex(d.color_timer_text),
    },
    sizes: {
      text: d.size_text,
      cta: d.size_cta,
      timer_digits: d.size_timer_digits,
      timer_labels: d.size_timer_labels,
    },
    updated_at: new Date(),
  }
}

export async function createPromoBar(_prev: PromoActionResult, fd: FormData): Promise<PromoActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const parsed = parseForm(fd)
  if (!parsed.success) {
    return { ok: false, message: 'Błędy walidacji: ' + parsed.error.issues.map((i) => i.path.join('.')).join(', ') }
  }
  const cid = await clientId()
  if (!cid) return { ok: false, message: 'Brak klienta' }
  const row = await prisma.promo_bars.create({
    data: { client_id: cid, enabled: false, ...toData(parsed.data) },
    select: { id: true },
  })
  revalidatePath('/promo')
  return { ok: true, message: 'Kampania utworzona (wyłączona — włącz przełącznikiem)', id: row.id }
}

export async function updatePromoBar(id: string, _prev: PromoActionResult, fd: FormData): Promise<PromoActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const parsed = parseForm(fd)
  if (!parsed.success) {
    return { ok: false, message: 'Błędy walidacji: ' + parsed.error.issues.map((i) => i.path.join('.')).join(', ') }
  }
  const cid = await clientId()
  if (!cid) return { ok: false, message: 'Brak klienta' }
  await prisma.promo_bars.updateMany({ where: { id, client_id: cid }, data: toData(parsed.data) })
  revalidatePath('/promo')
  return { ok: true, message: 'Zapisano', id }
}

export async function togglePromoBar(id: string, enabled: boolean): Promise<PromoActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const cid = await clientId()
  if (!cid) return { ok: false, message: 'Brak klienta' }
  await prisma.promo_bars.updateMany({
    where: { id, client_id: cid },
    data: { enabled, updated_at: new Date() },
  })
  revalidatePath('/promo')
  return { ok: true, message: enabled ? 'Pasek włączony ✅' : 'Pasek wyłączony' }
}

export async function deletePromoBar(id: string): Promise<PromoActionResult> {
  const guard = await assertRoleOrFail('EDITOR')
  if (!guard.ok) return { ok: false, message: guard.message }
  const cid = await clientId()
  if (!cid) return { ok: false, message: 'Brak klienta' }
  await prisma.promo_bars.deleteMany({ where: { id, client_id: cid } })
  revalidatePath('/promo')
  return { ok: true, message: 'Kampania usunięta' }
}
