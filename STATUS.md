# CRM Liveko — Status implementacji

> Aktualizuj ten plik po każdej sesji.
> Pełny plan: `C:\Asystent\Asystent\docs\plans\2026-03-26-crm-liveko.md`

---

## Stack

- Next.js 16.2.1 + App Router
- Prisma 7.5.0 + `@prisma/adapter-pg` (Prisma 7 wymaga adaptera — nie `url` w schema.prisma!)
- NextAuth v5 beta.30
- Tailwind CSS v4 + shadcn/ui
- PostgreSQL 16 (Docker lokalnie)

## Lokalizacja projektu

```
C:\Asystent\liveko-crm\
```

## Uruchomienie lokalne

```bash
# 1. Uruchom Docker Desktop (ręcznie) i uruchom Postgres
cd C:\Asystent\liveko-crm
docker compose up -d

# 2. Push schematu do DB (pierwsze uruchomienie)
npm run db:push

# 3. Seed danych startowych
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 4. Dev server
npm run dev
# → http://localhost:3000
# → admin@liveko.pl / admin123
```

## Ważne — Prisma 7 specyfika

- `url` w `prisma/schema.prisma` → USUNIĘTE
- Connection URL jest w `prisma.config.ts` (datasource.url)
- `PrismaClient` wymaga adaptera: patrz `lib/prisma.ts` → `new PrismaPg({ connectionString })`
- Package: `@prisma/adapter-pg` + `pg`

## Webhook dla Make/n8n

```
POST /api/webhooks/lead
Header: X-Webhook-Secret: <WEBHOOK_SECRET z .env>

{
  "email": "jan@kowalski.pl",
  "investment_slug": "nowarubierz",   ← lub "ekograbowa"
  "phone": "+48600123456",
  "name": "Jan Kowalski",
  "message": "Interesuje mnie działka",
  "source": "FACEBOOK",
  "utm_campaign": "wschodnia",
  "consent": true
}
```

## API dla n8n email automation (zastępuje Airtable)

```
# Pobierz leady bez emaila
GET /api/leads?autoEmailSent=false&investment_slug=nowarubierz
Header: X-Webhook-Secret: <secret>

# Oznacz email jako wysłany
PATCH /api/leads/:id
Header: X-Webhook-Secret: <secret>
Body: { "autoEmailSent": true }
```

---

## ZROBIONE ✅ — Sesja 2026-03-26

### Task 1 — Setup projektu ✅
- [x] Next.js 16 + TypeScript + Tailwind
- [x] Prisma 7 + `@prisma/adapter-pg`
- [x] NextAuth v5 beta
- [x] shadcn/ui (button, badge, card, dialog, input, select, table, textarea, label, separator, avatar, dropdown-menu, sheet, skeleton, sonner)
- [x] docker-compose.yml (Postgres 16)
- [x] .env + .env.example
- [x] Dockerfile (standalone output)
- [x] next.config.ts (standalone)
- [x] package.json scripts

### Task 2 — Schemat bazy danych ✅
- [x] prisma/schema.prisma (User, Investment, Unit, Client, Lead, LeadUnit, Note, Activity, MessageTemplate + wszystkie enumy)
- [x] prisma/seed.ts (admin + EkoGrabowa 14 lokali + NowaRubież 38 działek)
- [x] `npx prisma generate` ✅

### Task 3 — Autentykacja ✅
- [x] lib/prisma.ts (Prisma 7 + adapter-pg)
- [x] lib/auth.ts (NextAuth v5 credentials + JWT)
- [x] lib/auth-helpers.ts (requireAuth, requireAdmin)
- [x] types/next-auth.d.ts
- [x] middleware.ts (ochrona tras + RBAC)
- [x] app/api/auth/[...nextauth]/route.ts
- [x] app/(auth)/login/page.tsx

### Task 4 — Layout dashboardu ✅
- [x] app/(dashboard)/layout.tsx
- [x] components/layout/Sidebar.tsx (z kolorami per inwestycja)
- [x] components/layout/Header.tsx (avatar + wyloguj)
- [x] app/(dashboard)/page.tsx (redirect → /leads)

### Task 5 — Queries ✅
- [x] queries/leads.ts (getLeads z filtrami + getLeadById + getLeadsForEmailAutomation)
- [x] queries/clients.ts (getClients + getClientById)
- [x] queries/investments.ts (getInvestments + getInvestmentBySlug + getAgents)

### Task 6 — Server Actions ✅
- [x] actions/leads.ts (updateLeadStatus, assignAgent, markEmailSent)
- [x] actions/notes.ts (createNote)
- [x] actions/users.ts (createUser, toggleUserActive, resetUserPassword)

### Task 7+8 — Lista leadów z inline actions + Sheet slide-over ✅
- [x] app/(dashboard)/leads/page.tsx (server component)
- [x] app/(dashboard)/leads/_components/LeadStatusBadge.tsx
- [x] app/(dashboard)/leads/_components/LeadsClient.tsx (inline status dropdown, tel/mail links, notes badge)
- [x] app/(dashboard)/leads/_components/LeadSheet.tsx (Sheet slide-over z notatkami, statusem, agentem)

### Task 9 — Webhook + API dla n8n ✅
- [x] app/api/webhooks/lead/route.ts (POST — przyjmuje leady z Make/n8n/Meta Ads)
- [x] app/api/leads/route.ts (GET — pobieranie leadów dla n8n email automation)
- [x] app/api/leads/[id]/route.ts (PATCH — oznaczanie emailSent)

### Task 10 — Admin — użytkownicy ✅
- [x] app/(dashboard)/settings/users/page.tsx (dodawanie agentów, dezaktywacja)

---

## DO ZROBIENIA ⏳

### Task 11 — Deployment na Coolify
- [ ] Git init + GitHub repo
- [ ] Coolify: nowa usługa Docker, zmienne ENV, domena crm.liveko.pl
- [ ] Postgres na Coolify (osobna usługa)
- [ ] Pierwsze `db:push` + seed na serwerze

### Task 12 — Migracja z Airtable
- [ ] prisma/migrate-from-airtable.ts (jednorazowy skrypt)

### Małe poprawki (do zrobienia przed deploymentem)
- [x] Strona clients/page.tsx (lista klientów) ✅
- [x] app/(dashboard)/investments/[slug]/page.tsx (widok inwestycji + jednostki) ✅
- [x] .gitignore ✅
- [x] `npm run build` → ✅ BUILD PASSES (10 tras)

---

## Otwarte kwestie

- [ ] Domena dla CRM — ustalić: crm.liveko.pl?
- [ ] Docker Desktop musi być uruchomiony ręcznie przed `docker compose up -d`
- [ ] n8n workflow email — zaktualizować URL Airtable → `GET /api/leads?autoEmailSent=false`

*Ostatni update: 2026-03-26*
