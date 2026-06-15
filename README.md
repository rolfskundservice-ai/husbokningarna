# Stugbokning

Internt bokningssystem för uthyrning av stugor på gården. Byggt för:

- **Förvaltare (ADMIN)** – full kontroll, hanterar stugor och Airbnb-synk
- **Ägare (OWNER)** – ser allt, kan boka veckor
- **Partners i Polen (PARTNER)** – ser tillgänglighet och bokar veckor för de stugor de har åtkomst till, för sina fiskeresor

## Funktioner

- Veckobaserad kalender per stuga (ISO-vecka, mån–sön) som visar **Ledig / Bokad internt / Bokad via Airbnb**
- Inloggning per person (separata konton, ej delade lösenord)
- Skapa/avboka veckor direkt i kalendern
- **Airbnb-synk**: varje stuga kan ha en Airbnb iCal-export-länk. Systemet hämtar den länken och blockerar automatiskt de veckorna i kalendern på rätt hus — så Airbnb-bokningar och interna bokningar krockar inte
- Automatisk krockkontroll: går inte att dubbelboka en vecka

## Teknikstack

- **Next.js 14** (App Router, TypeScript)
- **PostgreSQL** + **Prisma**
- **NextAuth** (e-post/lösenord, roller)
- **Tailwind CSS**

## Komma igång (lokalt)

```bash
# 1. Installera beroenden
npm install

# 2. Starta databasen
docker compose up -d

# 3. Konfigurera miljövariabler
cp .env.example .env
# generera NEXTAUTH_SECRET: openssl rand -base64 32

# 4. Skapa databastabeller
npm run db:push

# 5. Skapa testanvändare och 3 stugor
npm run db:seed

# 6. Starta utvecklingsservern
npm run dev
```

Öppna http://localhost:3000 och logga in med kontona som skapades av seed-skriptet
(se konsol-output). **Byt lösenord direkt** — det görs enklast via `npm run db:studio`
och hashar nya lösenord, eller bygg en "byt lösenord"-sida senare.

## Koppla in Airbnb

1. Gå till Airbnb → Värdpanel → Kalender → välj rätt stuga → **Tillgänglighet** → **Synkronisera kalendrar** → kopiera **export-länken** (en `.ics`-URL).
2. Logga in som förvaltare → **Hantera stugor** → klistra in länken under rätt stuga → **Spara**.
3. Klicka **Synka nu** för att hämta bokningarna direkt.

Därefter synkas kalendern automatiskt var 30 minuter (se `vercel.json` om du
hostar på Vercel — Vercel Cron anropar `/api/sync/airbnb` med `CRON_SECRET`).

Om du **inte** hostar på Vercel, sätt upp en extern cron (t.ex. cron-job.org eller
en server-cron) som varje 30 min gör:

```
GET https://din-domän.se/api/sync/airbnb
Authorization: Bearer <CRON_SECRET>
```

## Hantera användare & åtkomst

I MVP-versionen läggs användare till via seed-skriptet (`prisma/seed.ts`) eller
direkt i databasen via `npm run db:studio`. Roller:

- `ADMIN` – ser och hanterar allt
- `OWNER` – ser och bokar allt, men hanterar inte stuginställningar
- `PARTNER` – ser/bokar endast stugor kopplade via `PropertyAccess`

För att ge en partner åtkomst till en specifik stuga, skapa en rad i
`property_access` (userId + propertyId).

## Produktion / deploy

- Deploy till **Vercel** (rekommenderas, cron ingår) eller valfri Node-host
- Databas: t.ex. **Neon**, **Supabase** eller **Railway** (Postgres)
- Sätt miljövariabler enligt `.env.example` i hostingens dashboard
- Kör `npx prisma migrate deploy` vid deploy istället för `db:push`

## Struktur

```
src/
  app/
    login/                 Inloggningssida
    dashboard/             Kalendervy (huvudvy, alla roller)
    admin/properties/      Hantera stugor + Airbnb-länkar (ADMIN)
    api/
      auth/[...nextauth]/  Inloggning
      properties/          CRUD för stugor
      bookings/            Skapa/ta bort bokningar
      availability/[id]/   Veckovis tillgänglighet för en stuga
      sync/airbnb/         Manuell + cron-triggad Airbnb-synk
  components/              UI-komponenter
  lib/                      Databas, auth, iCal-synk, veckologik
prisma/
  schema.prisma            Datamodell
  seed.ts                  Testdata (3 stugor, 4 användare)
```

## Framtida utbyggnad (byggt för att klara detta utan omskrivning)

- Fler stugor/hus: lägg bara till en ny `Property` (admin-UI eller seed)
- Fler externa kanaler (Booking.com etc): lägg till `airbnbIcalUrl` → generalisera
  till en `ExternalCalendarUrl`-tabell med flera per property
- E-postnotiser vid ny bokning (lägg till i `bookings`-API:et)
- "Glömt lösenord"-flöde
- Export av bokningar till PDF/Excel
