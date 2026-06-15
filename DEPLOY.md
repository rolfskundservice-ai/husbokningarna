# Snabbstart: lägg upp en test-version online (Vercel)

Detta får dig till en riktig URL (typ `https://stuga-bokning.vercel.app`)
som du och dina partners kan testa direkt, ingen lokal installation behövs
efter detta.

## 1. Skapa en gratis databas (Neon)

1. Gå till **https://neon.tech** → skapa konto (gratis, ingen kortuppgift krävs)
2. Skapa ett nytt projekt, t.ex. "stuga-bokning"
3. Kopiera **connection string** (den ser ut som
   `postgresql://user:pass@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`)
   — det är din `DATABASE_URL`

## 2. Lägg koden på GitHub

1. Skapa ett nytt repo på **github.com** (t.ex. `stuga-bokning`)
2. Ladda upp innehållet i denna mapp (dra och släpp på GitHub, eller
   via `git init` / `git add .` / `git commit` / `git push` om du har Git)

## 3. Importera till Vercel

1. Gå till **https://vercel.com** → logga in (samma konto som FastFlow, eller nytt)
2. **Add New Project** → välj GitHub-repot `stuga-bokning`
3. Vercel känner automatiskt igen Next.js — rör inga build-inställningar
4. Under **Environment Variables**, lägg till:

   | Namn | Värde |
   |---|---|
   | `DATABASE_URL` | connection string från Neon (steg 1) |
   | `NEXTAUTH_URL` | `https://<ditt-projektnamn>.vercel.app` (Vercel visar URL:en innan deploy också - du kan uppdatera denna efteråt om den ändras) |
   | `NEXTAUTH_SECRET` | en slumpad sträng, generera lokalt med `openssl rand -base64 32` eller `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `CRON_SECRET` | en annan slumpad sträng (samma kommando som ovan) |

5. Klicka **Deploy**

## 4. Skapa tabeller och testkonton i databasen

Efter att deployen är klar (eller redan innan, det funkar oavsett ordning):

På din egen dator, i projektmappen:

```bash
npm install
```

Skapa en `.env`-fil (kopiera `.env.example`) och klistra in **samma**
`DATABASE_URL` som du satte i Vercel. Kör sedan:

```bash
npm run db:push
npm run db:seed
```

Detta skapar tabellerna och 3 stugor + 4 testkonton direkt i Neon-databasen
(samma databas som din Vercel-deploy använder).

## 5. Klart

Öppna din Vercel-URL, logga in med ett av kontona som skrevs ut av
`db:seed` (t.ex. `forvaltare@example.com` / `ändra-mig-admin`) och testa.

Byt lösenord innan ni börjar använda systemet på riktigt — enklast just nu
via `npx prisma studio` (öppnar ett lokalt admin-gränssnitt mot databasen)
och skriv in en ny bcrypt-hash, eller säg till mig och jag bygger en
"byt lösenord"-sida.

## Airbnb-synk i produktion

Vercel Cron (definierad i `vercel.json`) anropar `/api/sync/airbnb` var 30
minuter automatiskt, och autentiserar med `CRON_SECRET` — inget extra
behövs så länge miljövariabeln är satt.
