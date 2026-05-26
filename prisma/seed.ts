import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('Seeding admin_users for EtinBOT...')

  const adminHash = await bcrypt.hash('admin123', 12)
  await prisma.adminUser.upsert({
    where: { email: 'kamil@etingroup.pl' },
    update: {},
    create: {
      email: 'kamil@etingroup.pl',
      name: 'Kamil (Superadmin)',
      passwordHash: adminHash,
      role: Role.SUPERADMIN,
    },
  })

  console.log('Seed done')
  console.log('  Superadmin: kamil@etingroup.pl / admin123')
  console.log('  ZMIEN HASLO po pierwszym logowaniu!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
