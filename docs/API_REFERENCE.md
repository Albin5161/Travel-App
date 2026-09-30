# API reference: our backend, and every outside API

Traced from `src/app/api/`, `src/server/` and the callers in `src/lib/` at `939a6bb`.
Covers Part 7 (backend) and Part 5 (Google APIs and others).

---

## Part 7: the backend

### In plain words

The "backend" is a handful of small functions that live in the same project as the app. Each file in
`src/app/api/` becomes a web address like `/api/extract`. When the website is deployed, these run on
Expo's hosting (EAS Hosting). The app sends them a request; they check who's asking, count it against
limits, do the work (call YouTube, Gemini, Google), save useful results, and answer.

| Question | Answer |
|---|---|
| Where does it run? | **Production:** EAS Hosting, on the same domain as the website (`xplore.expo.app`). `src/server/auth.ts` reads Cloudflare's `cf-connecting-ip` header "on EAS Hosting". **Development:** the Expo dev server (`npx expo start`) on the developer's Mac, Node.js. |
| Server framework | **Expo Router API routes.** A file `name+api.ts` exports `GET` / `POST` functions that take a web-standard `Request` and return a `Response`. No Express, no Next.js. `app.json` → `"web": { "output": "server" }` turns this on. |
| Shape of every route | `export async function POST(request) { return respond('<name>', async (log) => { const who = await caller(request, log); return <pipeline function>(await readJson(request), who); }); }` |
| Validation | `readJson()` refuses bodies over 16 KB (`413 too_large`) and non-JSON (`400`). Each pipeline function then checks its own fields: `clean()` trims and caps strings; place IDs must match `/^[A-Za-z0-9_-]{10,300}$/`; session tokens `/^[A-Za-z0-9_-]{16,64}$/`; YouTube IDs `/^[A-Za-z0-9_-]{11}$/`; coordinates must be finite and in range. |
| Errors | Every failure is an `ApiError(status, code, message)` → JSON `{"error":{"code","message"}}` (`respond()` in `src/server/errors.ts`). Timeouts become `504`. Anything unexpected becomes `500` with a generic message, and the real error only goes to the log. Upstream bodies are never passed to the app (`upstreamError()`); an upstream `429` becomes our `503 quota`. |
| Logging | One line per request (`writeLog()` in `src/server/log.ts`): route, status, duration, per-step timings, 8-character user ID, video ID. Never links, names, IP addresses or typed text. |
| Authentication | `caller()` → `identify()` in `src/server/auth.ts`: reads `Authorization: Bearer <token>`, checks it with Supabase `auth.getClaims(token)` (signature check against the project's published keys), and uses `claims.sub` as the user ID. No token → `401`. Bad or expired → `401`. **Without `SUPABASE_SECRET_KEY`:** development runs open as user `dev` (one warning); production refuses (`500 not_configured`). |
| Authorization | There are no roles. "Allowed" means "signed in, and under your limits": per user, per network (IP) and global daily caps (`src/server/limits.ts`). A database error while counting refuses the request (`503`), so a broken counter never means unlimited spending. |
| Secrets | Read only on the server via `env` in `src/server/env.ts`: `YOUTUBE_API_KEY` / `PLACES_API_KEY` (or `GOOGLE_API_KEY`), `GEMINI_API_KEY`, `APIFY_TOKEN`, `SUPABASE_SECRET_KEY`. None start with `EXPO_PUBLIC_`, so none are built into the app. A missing one gives `500 missing_key`. |

### Route table

| Route | Method | Purpose | Input (JSON body) | Output | Auth | External APIs | Database |
|---|---|---|---|---|---|---|---|
| `/api/extract` | POST | Read a YouTube or Instagram link and list its places | `{ url }` | `{status:'done', platform, cached, video{id,title,channel,durationSeconds,thumbnail,frames}, region, terrain, places[], usage{model,inputTokens,outputTokens}, signals?, timings}` or `{status:'assist', reason, video?, region?}` | Token required | YouTube Data API **or** Apify; Gemini; `i.ytimg.com` (HEAD) | `api_consume` (limits + cleanup), `api_extractions` read/write |
| `/api/match` | POST | Turn one place name (or a picked place ID) into a real place | `{ name, area?, region?, confidence?, placeId?, sessionToken? }` | `{status:'matched', place{placeId, location, address, types, photo}, needsCheck, cached, timings}` or `{status:'unmatched', needsCheck:true, …}` | Token required | Places Text Search, Place Details, Place Photos; Wikipedia / Commons | `api_match_begin`, `api_matches` write, photo cap via `api_consume` |
| `/api/sights` | POST | A city's best-known spots, when a video named none | `{ region }` | `{ region, terrain, places[], cached }` | Token required | Gemini | `api_extractions` (key `sights:…`), `api_consume` (counts as an extract) |
| `/api/search` | POST | "Missed one?" type-ahead; where you're staying | `{ input (≥3 chars), sessionToken, near? }` | `{ suggestions: [{placeId, name, where}] }` (≤6) | Token required | Places Autocomplete (New), up to twice | `api_consume` |
| `/api/place` | POST | Rating, hours and reviews for a place page | `{ placeId }` | `{status:'ok', rating, ratingCount, priceLevel, openNow, hours[], summary, reviews[≤3], googleMapsUri}` or `{status:'limited'}` | Token required | Place Details (Enterprise + Atmosphere fields) | `api_consume` only. **Never stored.** |
| `/api/city` | POST | Notes for a real city | `{ name, state?, near? }` | `{ notes: {summary, bestTime, idealStay, tips[], safety[], sources[]} \| null }` | Token required | Wikipedia, Wikivoyage; Gemini | `api_extractions` (key `city:…`), `api_consume` |
| `/api/frames` | POST | 3 YouTube frame URLs for places saved before frames existed | `{ videoId }` | `{ frames: string[] }` | Token required. **No rate limit.** | `i.ytimg.com` (HEAD) | none |
| `/api/feedback` | POST | Record Right / Wrong / added from the review screen | `{ videoId?, placeName, placeId?, verdict }` | `{ ok: true }` | Token required | none | `api_feedback` insert, `api_consume` |
| `/api/health` | GET | Is the server set up? (yes/no per key, never values) | none | `{ ok, keys{youtube,places,gemini}, protected, model, placesPhotos }` | **Public** | none | none (only checks a client exists) |

### Limits per route (defaults, `src/server/limits.ts`, each changeable by environment variable)

| Route | Per user | Per network (IP) | Global per day |
|---|---|---|---|
| extract, sights | 20 / hour | 60 / hour | 1,000 |
| match | 300 / hour | 900 / hour | Place Details 300 (only when nothing fresh is stored); Google photos 30 |
| Instagram (inside extract) | n/a | n/a | 20 reels; 1 transcript |
| search | 150 / hour | 450 / hour | 300 |
| place | 60 / hour | n/a | 30 (past it: `limited`, not an error) |
| city | 30 / hour | n/a | 100 (only when not cached) |
| feedback | 500 / hour | n/a | n/a |
| frames, health | none | none | none |

Over a per-user or per-IP limit: `429 rate_limited` ("You've added a lot in the last hour…"). Over a
global cap: `503 quota` ("We've reached today's limit. Try again tomorrow.").

### Which routes call what

- **Gemini:** `/api/extract`, `/api/sights`, `/api/city`
- **Google:** `/api/extract` (YouTube), `/api/match`, `/api/search`, `/api/place` (Places)
- **Database:** every route except `/api/frames` and `/api/health`

### The app's side of the calls (who calls each route)

| Route | Called by (function, file) | When |
|---|---|---|
| `/api/extract` | `readLink()`, `src/lib/extract.ts` | Pasting a link (after the phone cache misses) |
| `/api/match` | `readLink()`, `bestKnownSpots()`, `placeFromPick()`, `stayFromPick()`, `findStay()`, `refreshPlace()`, `betterPhoto()` | After extract (per place); picking a search result; choosing a stay; background refreshes at launch |
| `/api/sights` | `bestKnownSpots()` | `src/app/addplaces.tsx` when a video named no places but the city is known |
| `/api/search` | `searchPlaces()`, `findStay()` | "Missed one?" sheet (`src/components/verify/PlaceSearchSheet.tsx`); the stay picker in `src/app/trip/[id].tsx`. (The Search tab, `src/app/search.tsx`, searches saved places on the phone and doesn't call this route.) |
| `/api/place` | `usePlaceInfo()`, `src/lib/details.ts` | Opening a real place's page |
| `/api/city` | `useCityNotes()`, `src/lib/details.ts` | Opening a real city's page |
| `/api/frames` | `betterPhoto()` | Launch-time photo repair |
| `/api/feedback` | `sendVerdicts()` | End of the review screen, and each added place |

---

## Part 5: Google APIs (and the other outside services)

All Google calls except the web map are made **by the server**, with keys that never reach the app.

### 1. YouTube Data API v3: `videos.list`

| | |
|---|---|
| Endpoint | `GET https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=<id>` |
| Purpose | Title, description, tags, channel, publish date, duration, thumbnails |
| Where called | `getVideo()` in `src/server/youtube.ts`, from `extract()` |
| Auth | Header `X-Goog-Api-Key`: `YOUTUBE_API_KEY`, else `GOOGLE_API_KEY` (server env) |
| Exposed to the client? | No |
| Caching | The whole extraction is cached 30 days in `api_extractions` and on the phone |
| Rate limits in code | Only ours (extract limits). The comment says "1 quota unit". Google's daily quota is not stated in the repo. |
| Errors | Empty `items` → `404 video_unavailable` ("private or deleted"); non-2xx → `upstreamError` (`429` → `503 quota`, else `502`); 8 s timeout |
| Usage | Once per new YouTube video |

### 2. Google Places API (New): Text Search

| | |
|---|---|
| Endpoint | `POST https://places.googleapis.com/v1/places:searchText`, body `{textQuery, pageSize: 1}`, field mask `places.id` |
| Purpose | A place name → Google's place ID (top hit only) |
| Where called | `searchPlaceId()` in `src/server/places.ts`, from `match()` |
| Auth | `X-Goog-Api-Key`: `PLACES_API_KEY` or `GOOGLE_API_KEY` |
| Caching | `api_matches`: place ID kept forever, a miss for 7 days |
| Cost tier (per code comment) | "Text Search Essentials, IDs Only: no charge" |
| Errors | `upstreamError`; 8 s timeout |
| Usage | Once per new place name |

### 3. Google Places API (New): Place Details

Three different field sets, which Google bills differently (per the comments in `src/server/places.ts`):

| Call | Fields | Purpose | Where | Stored? |
|---|---|---|---|---|
| `getDetails()` | `id,location,types,formattedAddress,photos` | Coordinates, address, kind, photo references | `match()` | Place ID + coordinates in `api_matches` (coordinates 30 days). Address and types are not stored. |
| `getPhotoRefs()` | `photos` | Photo references for a known place | `photoFor()` when a Google photo is allowed | No ("photo names expire") |
| `getPlaceInfo()` | `rating,userRatingCount,priceLevel,currentOpeningHours,editorialSummary,reviews,googleMapsUri` | A place's page | `placeInfo()` → `/api/place` | **Never** stored ("Google's terms don't allow keeping these"). The phone keeps it in memory while open. |

- **Endpoint:** `GET https://places.googleapis.com/v1/places/<id>`
- **Auth:** header `X-Goog-FieldMask` + `X-Goog-Api-Key`
- **Session token:** `getDetails` can carry the search session token, to close an Autocomplete
  session.
- **Cost tiers, as the comments state them:**
  - `getDetails`: "Essentials… 10,000 free a month".
  - `getPhotoRefs`: "IDs Only… no charge".
  - `getPlaceInfo`: "Enterprise + Atmosphere (1,000 free a month)".
- **Timeouts:** 8 s. **Caps:** Place Details 300 a day (only when nothing fresh is stored); place
  info 30 a day.

### 4. Google Places API (New): Place Photos

| | |
|---|---|
| Endpoint | `GET https://places.googleapis.com/v1/<photo name>/media?maxWidthPx=800&skipHttpRedirect=true` |
| Purpose | A photo URL (`photoUri`) plus author credits |
| Where called | `getPhoto()`, from `photoFor()`, from `match()` |
| When | Only after a free Wikimedia photo wasn't found (`wikimediaPhoto()`), photos are on (`PLACES_PHOTOS != off`), and today's cap allows (`allowPhoto()`, **30 a day**) |
| Errors | Returns null (never fails the match); the app shows a video frame instead |
| Cached? | The URL is saved inside the place on the phone. Server: not stored. |
| Code comment | "a free allowance of 1,000 a month" |

### 5. Google Places API (New): Autocomplete

| | |
|---|---|
| Endpoint | `POST https://places.googleapis.com/v1/places:autocomplete`, body `{input, sessionToken, locationBias?: 50 km circle}` |
| Purpose | Type-ahead place search |
| Where called | `searchPlaces()` in `src/server/places.ts`, from `search()`. A second try without the last word when the first finds nothing. |
| Session tokens | The phone makes one per search (`newSearchSession()`); the code comment says a session is billed "for at most 12" requests |
| Caching | None |
| Cap | 300 a day global; the comment says "under Autocomplete's 10,000 free" a month |
| Timeout | 6 s |

### 6. Google Maps JavaScript API (web map)

| | |
|---|---|
| SDK | `@vis.gl/react-google-maps` (`APIProvider`, `Map`, `AdvancedMarker`) |
| Where called | `src/components/GoogleMap.web.tsx`: the **browser** loads it directly |
| Key | `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY`: **built into the web page, public by design**. `.env.example` says to restrict it in Google Cloud to the site's addresses and to the Maps JavaScript API only. Whether that's done is UNKNOWN from the repo. |
| Map ID | `EXPO_PUBLIC_GOOGLE_MAP_ID`, else `DEMO_MAP_ID` |
| On phones | Not implemented: `src/components/GoogleMap.tsx` shows "coming to the app soon" |
| Caching / limits | Browser and Google defaults; none in the code |

### Google APIs that are **not** used

- **No Routes, Directions or Distance Matrix API.** Travel times are estimated in `src/lib/geo.ts`.
- **No Geocoding API.** Places come from Text Search; the stay comes from Autocomplete + Details.
- **No native Maps SDK.**
- **No Google Sign-In.**

### Other outside services

| Service | Endpoint | Purpose | Where | Auth | Notes |
|---|---|---|---|---|---|
| Google Gemini | `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` | See [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) | `generate()`, `src/server/gemini.ts` | `x-goog-api-key: GEMINI_API_KEY` | 20 s timeout, retries |
| Apify: Instagram Reel Scraper | `api.apify.com/v2/acts/apify~instagram-reel-scraper/runs`, `/actor-runs/<id>`, `/datasets/<id>/items`, `/abort` | A reel's text, optional transcript | `getReel()`, `src/server/instagram.ts` | `Authorization: Bearer APIFY_TOKEN` | Cost cap per run $0.01 (text) / $0.12 (transcript); per-call timeout 28 s; aborts runs it stops waiting for |
| YouTube images | `i.ytimg.com/vi/<id>/maxres1.jpg` (HEAD) | Pick HD or HQ frames | `videoFrames()`, `src/server/pipeline.ts` | none | 3 s timeout |
| Wikipedia REST + API | `en.wikipedia.org/api/rest_v1/page/summary/…`, `en.wikipedia.org/w/api.php` | City notes; a place's article photo | `src/server/citynotes.ts`, `src/server/commons.ts` | none; `User-Agent` names the app and a contact email | 6 s / 4 s timeouts |
| Wikivoyage API | `en.wikivoyage.org/w/api.php` | City travel notes | `src/server/citynotes.ts` | none | Articles must be near the city's places |
| Wikimedia Commons API | `commons.wikimedia.org/w/api.php` | Free photos taken at a place | `src/server/commons.ts` | none | Filters out namesakes, maps, logos, SVGs, small images |
| Supabase | Project URL (REST, RPC, Auth, Realtime) | Sign-in, tables, functions, live updates | `src/server/supabase.ts` (secret key); `src/lib/live/client.ts` (publishable key) | Secret key (server) / publishable key + user token (app) | |
| PostHog | `EXPO_PUBLIC_POSTHOG_HOST` (default `https://us.i.posthog.com`) | Usage events | `src/lib/analytics.ts` | `EXPO_PUBLIC_POSTHOG_KEY` (public by design) | GeoIP off; loaded 2.5 s after start |
