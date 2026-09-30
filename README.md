# Xplore

*Formerly Raahi.* Turn the travel videos you saved into a trip you'll actually take.

Paste an Instagram reel or a YouTube link. Xplore finds every place in it, puts them on a map, and
plans the days. Plan alone, or share the plan and let friends vote on each stop.

One Expo codebase builds iOS, Android and the web. **The web build is what's live today, at
[xplore.expo.app](https://xplore.expo.app).** No App Store or Play Store builds are set up yet.

## How it works

```
Phone / browser (Expo, React Native)          Server (Expo API routes on EAS Hosting)
  screens, trips store, trip planner   ──►    /api/extract  → YouTube Data API or Apify → Gemini
  saved trips in device storage               /api/match    → Google Places (+ Wikimedia photos)
          │                                   caches, rate limits and daily caps in Supabase
          └── shared group trips ──► Supabase (Postgres, anonymous auth, realtime)
```

- **Client:** every screen, the trips store (`src/state/trips.tsx`), and the **trip planner**
  (`src/data/planner.ts`: plain rules, no AI, runs on the device and works offline). Saved places and
  plans are kept in device storage: `localStorage` on the web, `expo-sqlite`'s localStorage on phones.
- **Server:** API routes in `src/app/api/`, with the logic in `src/server/`. They hold every secret
  key, check the caller's anonymous Supabase token, apply rate limits and daily caps set under the
  providers' free allowances (`src/server/limits.ts`), and cache results for everyone.
- **AI:** Google Gemini (`gemini-3.5-flash-lite`, falling back to `gemini-3.8-flash`) reads video
  text into a list of places. It doesn't plan trips.
- **Database:** Supabase. It holds the server's shared caches and counters (`supabase/api.sql`) and
  shared group trips, members and votes (`supabase/schema.sql`). There are no user accounts: each
  install signs in anonymously.

The full, code-traced documentation is in **[docs/](docs/TECHNICAL_ARCHITECTURE.md)**: data flow,
database, API reference, AI, infrastructure, costs, scaling, security and a glossary.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npx expo start               # the app and the API routes, on localhost:8081
```

**Keys** (see `.env.example`):
- **For links to work:** `GEMINI_API_KEY`, plus a Google Cloud key with YouTube Data API v3 and
  Places API (New) enabled (`GOOGLE_API_KEY`, or `YOUTUBE_API_KEY` + `PLACES_API_KEY`).
- **Optional:**
  - `APIFY_TOKEN` (Instagram; without it, reels fall back to adding places by search)
  - `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY` (the web map for real cities)
  - `EXPO_PUBLIC_POSTHOG_KEY` (analytics)
- **Rule:** names starting `EXPO_PUBLIC_` are built into the app and are public; everything else
  stays on the server.

**Supabase** (needed for rate limits, caching and group trips; production refuses to run without it):
1. Create a project. `npx eas-cli@latest integrations:supabase:connect` writes
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local`. Add
   `SUPABASE_SECRET_KEY` for the server.
2. In the SQL Editor, run `supabase/schema.sql`, then `supabase/api.sql`. Both are safe to re-run.
3. In **Authentication → Sign In / Providers**, turn on **Anonymous sign-ins**.

Without `SUPABASE_SECRET_KEY`, the local API runs open (fine on your Mac only). Without the public
Supabase keys, group votes play a scripted demo instead of going live.

`GET /api/health` reports which keys the server has (yes or no, never the values).

**On a phone:** install Expo Go and scan the QR code from `npx expo start` (use `--tunnel` if the
phone and Mac aren't on the same Wi-Fi).

### What needs a development build

| Not in Expo Go | Stand-in |
|---|---|
| Background geofencing (arrival alerts) | Profile → **Try it** → "Arrive in …" runs the same path |
| Lock-screen notifications | An in-app banner |
| A Google map for real cities on phones | A placeholder; the native map isn't built yet (`src/components/GoogleMap.tsx`) |

The example links in `src/data/api.ts` (`EXAMPLE_LINKS`) play canned sample cities (Kochi,
Kottayam, Gokarna, Meghalaya) without calling the API. Every other link goes to the real API.

## Project structure

```
src/app/          screens (Expo Router); (tabs)/ is Home · Trips · Map · Profile
  api/            server endpoints: extract, match, sights, search, place, city, frames, feedback, health
src/server/       server logic: pipeline, Gemini, YouTube, Apify, Places, Wikimedia, limits, auth, storage
src/state/        trips store (device storage), group vote, live Supabase sync, arrival, location, sky
src/data/         planner, "why" lines, sample catalog, registry of places from real links, types
src/lib/          API client, link reading, Supabase client, sharing, PDF, analytics, geo helpers
src/components/   UI: sky/glass, maps, mascots, plan, share, group, onboarding…
src/theme/        colour, type and sky tokens
supabase/         database schema (run by hand in Supabase)
scripts/          test-api.mjs (runs real videos through the API), contrast check, asset tools
docs/             architecture documentation
```

## Checks

```bash
npx tsc --noEmit    # types
npx expo lint       # lint
npx expo-doctor     # dependency and config health
node scripts/test-api.mjs   # real videos through a running API (costs free-tier quota)
```

There's no CI: run these by hand.

## Deploying (web and API)

The website and the API routes deploy together to EAS Hosting. Server keys live in the EAS project's
environment variables. Preview first, then production:

```bash
npx expo export --platform web --clear
npx eas-cli@latest deploy --environment production --alias preview   # xplore--preview.expo.app
npx eas-cli@latest deploy --prod --environment production            # xplore.expo.app
```

## Good to know

- **Trips live on one device.** There are no accounts: clearing the browser or reinstalling loses
  saved places and plans, and only shared trips are in the database.
- **Travel times are estimates.** Straight-line distance × a terrain detour factor ÷ a typical speed
  (`src/lib/geo.ts`); no routing API is called.
- **Sample data:** the sample cities' ratings, reviews, costs and safety signals are illustrative.
  Kottayam's photos are placeholders; see [CREDITS.md](CREDITS.md).

Design system and motion: [DESIGN.md](DESIGN.md).
