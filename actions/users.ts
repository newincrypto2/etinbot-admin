'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export type ActionResult = {
  ok: boolean
  message?: string
  errors?: Record<string, string>
}

const ROLE_VALUES = [Role.SUPERADMIN, Role.OWNER, Role.EDITOR, Role.VIEWER] as const

const CreateUserSchema = z.object({
  email: z.string().email('Niepoprawny email'),
  name: z.string().min(2, 'Imię min. 2 znaki').max(100),
  password: z.string().min(8, 'Hasło min. 8 znaków').max(200),
  role: z.enum(ROLE_VALUES),
})

const UpdateUserSchema = z.object({
  name: z.string().min(2, 'Imię min. 2 znaki').max(100),
  role: z.enum(ROLE_VALUES),
  isActive: z.boolean().default(true),
})

const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Hasło min. 8 znaków').max(200),
})

function parseRole(v: FormDataEntryValue | null): Role {
  const s = typeof v === 'string' ? v : ''
  if ((ROLE_VALUES as readonly string[]).includes(s)) return s as Role
  return Role.VIEWER
}

// ---- Create ----

export async function createUser(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin()
  const parsed = CreateUserSchema.safeParse({
    email: (fd.get('email') as string)?.trim().toLowerCase() ?? '',
    name: (fd.get('name') as string)?.trim() ?? '',
    password: (fd.get('password') as string) ?? '',
    role: parseRole(fd.get('role')),
  })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  })
  if (existing) {
    return { ok: false, message: 'Użytkownik z tym emailem już istnieje' }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const { activeClientId } = await import('@/lib/tenant')
  await prisma.adminUser.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
      clientId: await activeClientId(),  // user nalezy do aktywnego tenanta
    },
  })
  revalidatePath('/settings/users')
  return { ok: true, message: 'Użytkownik dodany' }
}

// ---- Update (name + role + active) ----

export async function updateUser(
  userId: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  await requireAdmin()
  const parsed = UpdateUserSchema.safeParse({
    name: (fd.get('name') as string)?.trim() ?? '',
    role: parseRole(fd.get('role')),
    isActive: fd.get('isActive') === 'on' || fd.get('isActive') === 'true',
  })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: 'Błędy walidacji', errors }
  }

  await prisma.adminUser.update({
    where: { id: userId },
    data: parsed.data,
  })
  revalidatePath('/settings/users')
  return { ok: true, message: 'Zaktualizowano' }
}

// ---- Toggle active (quick action) ----

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  await requireAdmin()
  const user = await prisma.adminUser.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, message: 'Nie istnieje' }
  await prisma.adminUser.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  })
  revalidatePath('/settings/users')
  return { ok: true }
}

// ---- Reset hasła ----

export async function resetUserPassword(
  userId: string,
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  await requireAdmin()
  const parsed = ResetPasswordSchema.safeParse({
    newPassword: (fd.get('newPassword') as string) ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Błąd' }
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.adminUser.update({
    where: { id: userId },
    data: { passwordHash },
  })
  return { ok: true, message: 'Hasło zresetowane' }
}

// ---- Edycja własnych danych (self-service, każdy zalogowany) ----

const UpdateOwnNameSchema = z.object({
  name: z.string().min(2, 'Imię min. 2 znaki').max(100),
})

/** Użytkownik edytuje WYŁĄCZNIE własne imię i nazwisko — konto z sesji. */
export async function updateOwnName(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return { ok: false, message: 'Brak sesji — zaloguj się ponownie' }

  const parsed = UpdateOwnNameSchema.safeParse({
    name: (fd.get('name') as string)?.trim() ?? '',
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Błąd walidacji' }
  }

  await prisma.adminUser.update({
    where: { email },
    data: { name: parsed.data.name },
  })
  revalidatePath('/konto')
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Dane zapisane' }
}

// ---- Zmiana własnego hasła (self-service, każdy zalogowany) ----

const ChangeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Podaj obecne hasło'),
    newPassword: z.string().min(8, 'Nowe hasło min. 8 znaków').max(200),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Hasła nie są identyczne',
    path: ['confirmPassword'],
  })

/**
 * Użytkownik zmienia WYŁĄCZNIE własne hasło — konto z sesji, nie z formularza.
 * Wymaga podania obecnego hasła (weryfikacja bcrypt).
 */
export async function changeOwnPassword(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return { ok: false, message: 'Brak sesji — zaloguj się ponownie' }

  const parsed = ChangeOwnPasswordSchema.safeParse({
    currentPassword: (fd.get('currentPassword') as string) ?? '',
    newPassword: (fd.get('newPassword') as string) ?? '',
    confirmPassword: (fd.get('confirmPassword') as string) ?? '',
  })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    parsed.error.issues.forEach((i) => { errors[i.path.join('.')] = i.message })
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Błędy walidacji', errors }
  }

  const user = await prisma.adminUser.findUnique({ where: { email } })
  if (!user || !user.isActive) return { ok: false, message: 'Konto nieaktywne' }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) return { ok: false, message: 'Obecne hasło jest niepoprawne' }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash },
  })
  return { ok: true, message: 'Hasło zmienione' }
}

// ---- Delete ----

export async function deleteUser(userId: string): Promise<ActionResult> {
  await requireAdmin()
  // Ochrona: nie pozwól usunąć samego siebie
  const session = await auth()
  const me = session?.user?.email
    ? await prisma.adminUser.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
    : null
  if (me?.id === userId) {
    return { ok: false, message: 'Nie możesz usunąć własnego konta' }
  }

  // Ochrona: nie pozwól usunąć ostatniego SUPERADMIN
  const target = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (target?.role === Role.SUPERADMIN) {
    const otherSupers = await prisma.adminUser.count({
      where: { role: Role.SUPERADMIN, id: { not: userId } },
    })
    if (otherSupers === 0) {
      return { ok: false, message: 'Nie możesz usunąć ostatniego superadmina' }
    }
  }

  await prisma.adminUser.delete({ where: { id: userId } })
  revalidatePath('/settings/users')
  return { ok: true, message: 'Usunięto' }
}
