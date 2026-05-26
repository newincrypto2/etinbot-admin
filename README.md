# Silver Place Bot — Admin Panel

Panel administracyjny dla bota AI obsługującego gości aparthotelu **Silver Place + Silver Forest**.

> **Status:** scaffolding (klon Liveko CRM). Funkcjonalne ekrany — Sprint 5 wg `silverplace-bot/IMPLEMENTATION-PLAN.md`.

## Co to robi

Brat (operator obiektu) loguje się tu, żeby:

- 📊 **Dashboard** — zobaczyć ile konwersacji bot obsłużył, jakie pytania były najczęstsze, gdzie się myli
- 📝 **FAQ editor** — edytować odpowiedzi bota (Q/A), dodawać nowe pytania, zmieniać scope (SP / SF / both)
- 🏠 **Apartamenty** — zarządzać danymi lokali (WiFi, kody, parking, smartlocks)
- 💬 **Konwersacje** — przeglądać historię rozmów z gośćmi (live + archive)
- 🚨 **Eskalacje** — odbierać sprawy poza zakresem bota, akceptować propozycje nowych FAQ (auto-learning)
- ⚙️ **Settings** — klucze API, brand bota, godziny eskalacji

## Stack

- **Next.js 16** + App Router + TypeScript
- **Prisma 7** + Postgres 16 + pgvector (shared z bot service)
- **NextAuth v5** (Auth.js) — login z bcrypt, role-based access
- **shadcn/ui** + Tailwind 4 — komponenty
- **TipTap** — rich text editor dla FAQ answers

## Powiązanie z botem

Panel i bot **dzielą tę samą bazę danych** (`silverplace` Postgres na Coolify).

```
silverplace-bot (Python+FastAPI)        silverplace-bot-admin (Next.js)
  - czyta FAQ                             - edytuje FAQ
  - pisze konwersacje                     - czyta metryki
  - tworzy eskalacje                      - rozwiązuje eskalacje
        └──────────────┬─────────────────────────┘
                       ▼
              Postgres 16 + pgvector
                  (Coolify VPS)
```

## Lokalne uruchomienie

```bash
# 1. Najpierw uruchom silverplace-bot Postgres
cd ../silverplace-bot
make up

# 2. Tu skonfiguruj env
cp .env.example .env.local
# Uzupełnij DATABASE_URL (z hasłem z silverplace-bot/.env)
# Wygeneruj NEXTAUTH_SECRET: openssl rand -base64 32

# 3. Zainstaluj zależności
npm install

# 4. Wygeneruj Prisma z DB (introspect istniejących tabel bota)
npx prisma db pull
npx prisma generate

# 5. Push tabeli admin_users (jedyny model lokalny dla panelu)
npx prisma db push

# 6. Seed (utwórz superadmina)
npx prisma db seed

# 7. Dev server
npm run dev
# → http://localhost:3000
```

## Roadmap

| Etap | Co | Status |
|------|-----|--------|
| Klon Liveko + cleanup | Skopiowanie + wyrzucenie Liveko-specific | ✅ |
| Prisma db pull | Introspect z silverplace bota DB | ⏳ |
| Branding | Logo / kolory / metadata | ⏳ |
| FAQ editor | CRUD pytań + walidacja scope | ⏳ Sprint 5 |
| Apartments | CRUD apartamentów | ⏳ Sprint 5 |
| Conversations | Live monitoring + historia | ⏳ Sprint 5 |
| Escalations | Lista + accept-as-faq button | ⏳ Sprint 5 |
| Dashboard | Metryki z DB | ⏳ Sprint 5 |
| Settings | Klucze API, brand, eskalacje | ⏳ Sprint 5 |

## Co zachowane z Liveko CRM (reuse)

✅ Auth (NextAuth + Prisma Adapter + bcrypt)
✅ shadcn/ui komponenty (`components/ui/`)
✅ Layout (sidebar, navbar — `components/layout/`)
✅ Login page (`app/(auth)/login`)
✅ Settings/users (CRUD userów panelu)
✅ Rate limiting (`lib/rate-limit.ts`)
✅ Resolve user middleware (`lib/resolve-user.ts`)
✅ Theme support (next-themes)

## Co wyrzucone

❌ Voice CRM Telegram (`api/voice`, `components/voice`, `lib/voice`, `lib/groq.ts`)
❌ Leady (`api/leads`, `(dashboard)/leads`, `actions/leads*`)
❌ Mailingi (`(dashboard)/mailings`, `lib/sendy.ts`, `actions/mailings.ts`)
❌ Investments (`(dashboard)/investments`, `actions/investments.ts`)
❌ Liveko klienci (`(dashboard)/clients`, `actions/clients.ts`)
❌ Activity Feed (Liveko-specific)
❌ Lead webhook (`api/webhooks/lead`)

## Powiązane

- `C:\Asystent\silverplace-bot\` — bot service (Python + FastAPI)
- `C:\Asystent\Asystent\Zadania\projekty\silverplace-bot\` — dokumentacja projektu
- `https://github.com/newincrypto2/liveko-crm` — źródło patternu
