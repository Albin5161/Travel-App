# Cost model

Part 11. Every service that could cost money, what triggers it, and how many calls each user action
makes, traced from the code at `939a6bb`.

**About prices.** The repository contains some prices and free allowances **in code comments**. They
were written by the developer and dated around September 2026. They're quoted here as "per code
comment", not as verified facts. Everything else is marked **Needs current provider pricing
verification.** No price has been invented.

## In plain words

Almost everything Xplore does sits inside free allowances, **on purpose**. The server has hard daily
caps (`src/server/limits.ts`) set just under the free monthly amounts, so when a cap is reached users
see "We've reached today's limit" instead of the bill going up. The expensive part of the app, reading
a video and finding its places, is **cached and shared**: the second person to paste the same video
costs nothing, and a place name found once is reused by everyone. Planning a trip costs **nothing**:
it runs on the phone.

---

## 1. The services

| # | Provider / API | Pricing known from the repo | What triggers a call | Cached? | Free tier? | Can the call be avoided? |
|---|---|---|---|---|---|---|
| 1 | **Google Gemini API**: `gemini-3.5-flash-lite` (backup `gemini-3.8-flash`) | "Both are free" (the free tier, per the comment in `src/server/env.ts`). Paid token prices: **needs current provider pricing verification.** | New video (1, sometimes 2 for Instagram); best-known spots per city; city notes per city | Yes: video 30 days, city spots 30 days, city notes 30 days, all shared | Yes (per the comment); its rate limits aren't in the repo | Repeats already are |
| 2 | **YouTube Data API v3** `videos.list` | "1 quota unit" per call (comment). Quota, not money, by default. Daily quota size: **needs verification.** | New YouTube video | Yes, 30 days | Yes (quota) | Repeats already are |
| 3 | **Apify**: Instagram Reel Scraper | "about $0.0036 a reel including the run start, plus $0.048 per started minute when the transcript is on" (comment, `src/server/instagram.ts`). Per-run caps in code: $0.01 (text), $0.12 (transcript). "The free plan's $5 a month is enough" (`.env.example`). | New Instagram reel; a transcript only if the text names nothing and the reel is ≤2 min | Yes, 30 days | $5 monthly credit (per comment) | Repeats already are; transcripts capped at 1 a day |
| 4 | **Places Text Search** (IDs only) | "no charge" (comment) | New place name | Place ID kept forever | n/a | Yes, for known names |
| 5 | **Place Details, Essentials** (location, types, address, photos) | "10,000 free a month" (comment) | New place, or its coordinates are older than 30 days | Coordinates 30 days | Yes | Capped at 300 a day |
| 6 | **Place Details, photos only** | "no charge" (comment) | A Google photo is wanted for a stored place | No | n/a | n/a |
| 7 | **Place Photos** | "free allowance of 1,000 a month" (comment) | Only when Wikimedia has no photo | URL kept on the phone | Yes | Wikimedia first; capped at 30 a day |
| 8 | **Autocomplete (New)** | "10,000 free" a month; a session is billed "for at most 12" requests (comments) | Typing in "Missed one?" or the stay picker | No | Yes | Capped at 300 a day |
| 9 | **Place Details, Enterprise + Atmosphere** (rating, hours, reviews) | "1,000 free a month" (comment) | Opening a real place's page | Only in phone memory while open (Google's terms) | Yes | Capped at 30 a day; past it the page shows without reviews |
| 10 | **Maps JavaScript API** (web map) | Not in the repo: **needs current provider pricing verification** | Each web map load (Map tab, city map, plan) | Browser only | Needs verification | No cap in code |
| 11 | **Supabase** | Not in the repo: **needs verification** | Every API request (1–3 database calls); group trips; realtime | n/a | Needs verification (the code assumes the free plan) | n/a |
| 12 | **EAS Hosting** | Not in the repo: **needs verification** | Every page and API request | n/a | Needs verification | n/a |
| 13 | **PostHog** | "free plan: 1M events a month, stops rather than charges" (`.env.example`) | ~16 kinds of events per user journey | n/a | Yes | n/a |
| 14 | **Wikimedia APIs** | Free (no key) | Place photos, city notes | Through the match and city-note caches | Free | n/a |
| 15 | Apple / Google developer accounts | Not in the repo | n/a | n/a | n/a | n/a |

---

## 2. Calls per user action

`N` = number of places Gemini found in the video (at most 25; the app matches all of them).

### Pasting a **new** YouTube video

| Call | Count | Notes |
|---|---|---|
| Our API `/api/extract` | 1 | |
| Supabase: limits + cleanup, read cache, write cache | 3 | `api_consume`, `select`, `upsert` |
| YouTube `videos.list` | 1 | |
| `i.ytimg.com` HEAD | 1 | free |
| **Gemini** | **1** (up to 3 attempts on 429/5xx) | input ≈ system rules (~2,700 characters) + title/tags/description (≤6,000 characters of description). A rough guide is ~4 characters per token, so ~1,000–2,500 input tokens. Output ≈ a JSON list, roughly 50–100 tokens per place. **Real counts are stored per video in `api_extractions.result.usage`.** |
| Our API `/api/match` | N | 5 at a time |
| Supabase per match | 2–3 | `api_match_begin`, `upsert`, and (when a Google photo is needed) the photo cap |
| Places Text Search | up to N | only for names never seen before |
| Place Details Essentials | up to N | only when nothing fresh is stored |
| Wikimedia | up to N × a few requests | free |
| Place Photos (+ free photo refs) | ≤ N, but at most 30 a day total | only when Wikimedia has none |
| Our API `/api/feedback` | N (+ added places) | 1 insert each |
| PostHog | ~3 events | link pasted, places found, places saved |

### Pasting a video **someone already pasted** (within 30 days)

- **On the same phone:** 0 calls; the answer is read from the phone.
- **On another phone:** `/api/extract` (3 Supabase calls: limits, read, and for YouTube a frames HEAD
  if missing) + N × `/api/match`. The matches are stored, so there's **no Google Places charge**
  except photos (Wikimedia first, Google photos capped). **No Gemini, no YouTube call.**

### Pasting a new **Instagram** reel

Everything in the YouTube case, except that **Apify 1 run** replaces the YouTube call. If the text
names nothing: **+1 Apify transcript run + 1 more Gemini call** (≤2 min reels, 1 a day).

### Planning a trip

| Call | Count |
|---|---|
| Planner | **0 calls.** Runs on the phone. |
| "Staying in town" | 1 Autocomplete + 1 match (Details if not stored) |
| Picking a hotel | Autocomplete while typing (one session) + 1 match |
| Reshuffle / edit / add a day | 0 |

### Other actions

| Action | Calls |
|---|---|
| Opening a real place's page | 1 `/api/place` → 1 Place Details Enterprise + Atmosphere (30 a day cap), 1 Supabase |
| Opening a real city's page | 1 `/api/city`. Cached city: 1 Supabase read. New city: Wikipedia/Wikivoyage + **1 Gemini** + Supabase |
| Video named no places | 1 `/api/sights` (**1 Gemini** per city per 30 days) + matches for ≤10 places |
| Sharing a live trip | 1 Supabase RPC `create_trip` + 1 Auth call (first time only) + a realtime connection while the group screen is open |
| Joining | 1 RPC `join_trip` + 3 table reads + realtime |
| Voting / editing a shared plan | 1 upsert / update each |
| App launch (returning user) | Up to 10 `/api/match` for places with coordinates older than 30 days, and up to 30 for photo repair (each usually served from `api_matches` + Wikimedia) |
| Any screen | PostHog events (counts only) |
| Web map view | 1 Maps JavaScript API map load (not capped in code) |

---

## 3. Formulas

```
Cost per new video (YouTube) =
    Gemini(1 call: tokens_in × price_in + tokens_out × price_out)      [free tier today]
  + YouTube(1 quota unit)                                               [quota, not money]
  + Σ over new place names: TextSearch(IDs only: $0 per comment)
                          + Details Essentials (free ≤10k/month per comment)
  + Σ over places without a Wikimedia photo: Place Photo (free ≤1k/month per comment)
  + Supabase(≈ 3 + 3N small queries)
  + Hosting(1 + N + N function requests)

Cost per new Instagram reel = the same, with YouTube replaced by
    Apify ≈ $0.0036 (per comment)  [+ $0.048 per started transcript minute + 1 more Gemini call, when needed]

Cost per repeated video = Supabase + Hosting (+ photos only if Wikimedia has none and none is stored)

Cost of planning = $0 (on the phone)

Cost per user per month =
    videos_new   × Cost per new video
  + videos_repeat × Cost per repeated video
  + place_pages_opened × Details Enterprise+Atmosphere (free ≤1k/month per comment)
  + new_cities_viewed × (Gemini 1 call)
  + searches × Autocomplete session (free ≤10k/month per comment)
  + map_loads × Maps JavaScript API                  [needs pricing verification]
  + share_or_vote_actions × Supabase writes + realtime minutes
  + analytics_events × PostHog (free ≤1M/month per comment)
```

### Today's effective cost

With the default caps, spending is designed to be **$0 beyond fixed plans**:
- **Google Places:** at most 300 Details a day (~9,000 a month, under 10,000), 30 photos a day (~900,
  under 1,000), 300 searches a day (~9,000, under 10,000), and 30 place pages a day (~900, under
  1,000). This is the reasoning in the comment at the top of `src/server/limits.ts`.
- **Apify:** 20 reels a day ≈ $2.20 a month and 1 transcript a day ≈ $3 a month at most, "spread
  over Apify's $5 of free monthly credit" (same comment).
- **Gemini:** on the free tier; the per-day extraction cap is 1,000.
- **Not capped in code:** Maps JavaScript API map loads, EAS Hosting, Supabase, PostHog. Their costs
  depend on plans that need verification.

**Likely cost per user today:** effectively $0 in variable spend while under the caps. The real
limit is *capacity*, not money: see [SCALING.md](SCALING.md).

## 4. Caching that already reduces cost

| Cache | Where | Lifetime | Shared? |
|---|---|---|---|
| Link result | Phone `xplore.link.v2.*` | 30 days | This device |
| Video extraction | `api_extractions` | 30 days | Everyone |
| Place name → place ID | `api_matches.place_id` | Forever | Everyone |
| Place coordinates | `api_matches.lat/lng` | 30 days | Everyone |
| "Google has no match" | `api_matches` (null ID) | 7 days | Everyone |
| City notes / best-known spots | `api_extractions` (`city:`, `sights:`) | 30 days | Everyone |
| Place page info | Phone memory | While the app is open | This device |
| Free photos first | Wikimedia before Google Photos | n/a | n/a |
| Cheapest field tiers | Text Search IDs-only; Details Essentials fields only (no `displayName`, per comment) | n/a | n/a |
