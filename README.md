# Wiskunde Tool

Een eenvoudige, interactieve webapp voor in de klas: leerlingen oefenen optellen en aftrekken (en opties voor ×, ÷ en gemengde sommen) op hun eigen apparaat; de leerkracht start een sessie met een code en ziet live hoe iedereen het doet.

## Vereisten op jouw computer

- **Node.js** (LTS) — [nodejs.org](https://nodejs.org/)

## Lokaal starten

```bash
cd "Wiskunde Tool"
npm install
```

### Supabase instellen

1. Maak een gratis project op [supabase.com](https://supabase.com/).
2. Ga naar **Project Settings → API** en kopieer **Project URL** en **anon public** key.
3. Maak het bestand `.env.local` (kopieer `.env.example`) en vul:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

4. Open **SQL Editor** in Supabase en voer **alle** scripts in [`supabase/migrations/`](supabase/migrations/) uit, **in volgorde van bestandsnaam** (oudste eerst). Elk bestand plakken en _Run_. Zo blijven tabellen, RLS, functies en Realtime in sync met de app.

5. Start de app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) voor leerlingen en [http://localhost:3000/teacher](http://localhost:3000/teacher) voor het docentenpaneel.

## Op internet zetten (aanbevolen: Vercel + Supabase)

Je Supabase-project staat al online; je hoeft alleen de **Next.js-app** te hosten en dezelfde API-keys te gebruiken.

### 1. GitHub-repository (alleen deze map)

Zorg dat de map **Wiskunde Tool** (met `package.json` en `src/`) de root van je repo is — niet je hele gebruikersmap. Lokaal bijvoorbeeld:

```bash
cd "pad/naar/Wiskunde Tool"
git init
git add .
git commit -m "Eerste versie Wiskunde Tool"
```

Maak een lege repo op GitHub en push (`git remote add …`, `git push -u origin main`).

### 2. Vercel

1. Ga naar [vercel.com](https://vercel.com/), log in met GitHub.
2. **Add New → Project** en importeer de repository.
3. Framework: **Next.js** (wordt meestal automatisch herkend). Build: `npm run build`, output standaard.
4. **Environment Variables** (voor *Production* — en desgewenst *Preview*):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | je Project URL uit Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | je **anon public** key |

5. **Deploy**. Noteer je productie-URL, bv. `https://wiskunde-tool.vercel.app`.

### 3. Supabase voor je live URL

In het Supabase-dashboard:

- **Authentication → URL configuration**
  - **Site URL:** zet dit op je Vercel-URL (bv. `https://wiskunde-tool.vercel.app`).
  - **Redirect URLs:** voeg dezelfde URL toe (en eventueel `https://jouwdomein.nl` als je later een eigen domein koppelt). Zo werken docent **registratie / e-mailbevestiging** en redirects correct.
- **Authentication → Providers:** **Anonymous** aan voor leerlingen (zoals lokaal).
- **Project Settings → API:** controleer dat je de **anon** key in Vercel hebt gezet (niet de *service_role*).

Na een wijziging in env-vars op Vercel: opnieuw **Redeploy** (of wacht op de volgende push).

### 4. Klaar voor de klas

Deel met leerlingen de **startpagina** van je Vercel-site (`/`). Jij gebruikt **`/teacher`** (account aanmaken of inloggen). Zelfde Supabase-database als lokaal — data en klassen zijn gedeeld.

## Gebruik in de les (huidige versie)

1. **Docent:** `/teacher` → registreren/inloggen → schoolnaam en klassen aanmaken → missies toevoegen.
2. **Leerling:** startpagina → school, klas, voornaam (zoals bij de docent ingesteld) → missies kiezen en oefenen.
3. Live resultaten en export blijven beschikbaar op het docentenscherm.

## Talen

Op elke pagina kun je **NL** / **EN** kiezen; de voorkeur wordt in de browser bewaard.

## Schaal (40+ leerlingen)

De site draait in de browser; Supabase (gratis tier) is ruim voldoende voor decennia aan gelijktijdige leerlingen in één klas. Voor problemen op school-WiFi: controleer of `*.supabase.co` bereikbaar is.

## Projectstructuur (kort)

- `src/app/page.tsx` — leerlingenstart
- `src/app/teacher/page.tsx` — docent
- `src/app/page.tsx` + `KidJoinForm.tsx` / `intro` / `oefenen` — leerlingflow; `TeacherApp.tsx` — docent
- `src/lib/math.ts` — genereren van sommen
- `supabase/migrations/` — database + Realtime

## Licentie

Private / voor eigen gebruik in de klas.
