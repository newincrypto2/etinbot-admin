'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import type { ActionResult } from '@/actions/client'

const CLIENT_SLUG = process.env.CLIENT_SLUG ?? 'matysproperty'

const PhoneSchema = z
  .string()
  .trim()
  .min(7, 'Numer za krótki')
  .max(20, 'Numer za długi')
  .regex(/^\+?\d[\d\s.-]*$/, 'Niepoprawny format numeru')

const RecipientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Nazwa wymagana').max(80),
  phone: PhoneSchema,
  role: z.enum(['office', 'security', 'manager', 'owner']),
  scope: z.enum(['all', 'silver-place', 'silver-forest']).default('all'),
  severityFilter: z.enum(['all', 'urgent_only', 'normal_only']).default('all'),
  smsEnabled: z.boolean().default(true),
  isActive: z.boolean().default(true),
  note: z.string().trim().max(200).optional().or(z.literal('')),
})

function _normalizePhone(p: string): string {
  // Strip whitespace, dots, dashes — keep + and digits
  const cleaned = p.replace(/[\s.\-]/g, '')
  // PL fallback: 9 digits → +48
  if (/^\d{9}$/.test(cleaned)) return `+48${cleaned}`
  if (/^0\d{9}$/.test(cleaned)) return `+48${cleaned.slice(1)}`
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

export async function upsertEscalationRecipient(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  await assertRoleOrFail('OWNER')

  const raw = {
    id: (fd.get('id') as string) || undefined,
    name: fd.get('name') as string,
    phone: fd.get('phone') as string,
    role: fd.get('role') as string,
    scope: (fd.get('scope') as string) || 'all',
    severityFilter: (fd.get('severityFilter') as string) || 'all',
    smsEnabled: fd.get('smsEnabled') === 'on',
    isActive: fd.get('isActive') === 'on',
    note: (fd.get('note') as string) || '',
  }

  const parsed = RecipientSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      errors[issue.path.join('.')] = issue.message
    }
    return { ok: false, message: 'Niepoprawne dane formularza', errors }
  }

  const data = parsed.data
  const client = await prisma.clients.findUnique({ where: { slug: CLIENT_SLUG }, select: { id: true } })
  if (!client) return { ok: false, message: 'Klient nie znaleziony' }

  const phoneNormalized = _normalizePhone(data.phone)
  const scopeOrNull = data.scope === 'all' ? null : data.scope
  const noteOrNull = data.note && data.note.length > 0 ? data.note : null

  if (data.id) {
    await prisma.escalation_recipients.update({
      where: { id: data.id },
      data: {
        name: data.name,
        phone: phoneNormalized,
        role: data.role,
        scope: scopeOrNull,
        severity_filter: data.severityFilter,
        sms_enabled: data.smsEnabled,
        is_active: data.isActive,
        note: noteOrNull,
      },
    })
  } else {
    await prisma.escalation_recipients.create({
      data: {
        client_id: client.id,
        name: data.name,
        phone: phoneNormalized,
        role: data.role,
        scope: scopeOrNull,
        severity_filter: data.severityFilter,
        sms_enabled: data.smsEnabled,
        is_active: data.isActive,
        note: noteOrNull,
      },
    })
  }

  revalidatePath('/settings/escalation')
  return { ok: true, message: data.id ? 'Zaktualizowano odbiorcę' : 'Dodano odbiorcę' }
}

export async function deleteEscalationRecipient(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertRoleOrFail('OWNER')
  const id = fd.get('id') as string
  if (!id) return { ok: false, message: 'Brak ID' }
  await prisma.escalation_recipients.delete({ where: { id } })
  revalidatePath('/settings/escalation')
  return { ok: true, message: 'Usunięto odbiorcę' }
}

export async function toggleEscalationRecipient(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await assertRoleOrFail('OWNER')
  const id = fd.get('id') as string
  const field = fd.get('field') as string
  if (!id || !['sms_enabled', 'is_active'].includes(field)) return { ok: false }
  const current = await prisma.escalation_recipients.findUnique({ where: { id } })
  if (!current) return { ok: false, message: 'Nie znaleziono' }
  await prisma.escalation_recipients.update({
    where: { id },
    data: { [field]: field === 'sms_enabled' ? !current.sms_enabled : !current.is_active },
  })
  revalidatePath('/settings/escalation')
  return { ok: true }
}
