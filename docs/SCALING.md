# Scaling and failure scenarios

Part 12 (user volume) and Part 13 (failures): how the architecture **as it is today** behaves.
No redesign. Traced from `src/server/limits.ts`, `src/server/pipeline.ts`, `src/lib/extract.ts`,
`src/lib/api.ts` and `src/state/*` at `939a6bb`.

## In plain words

The app has two very different halves:

- **The phone half** (saved places, planning, editing) scales for free. Each person's phone does its
  own work, and nothing is shared.
- **The server half** (reading videos, finding places) is protected by **hard daily caps** that keep
  spending at zero. That's also its weakness: the caps are shared by *everyone*, so past a few dozen
  new videos a day, new users start seeing "We've reached today's limit". The shared caches soften
  this, because popular videos and places are only paid for once.

---

## Part 12: what happens at each size

### The fixed ceilings (defaults in `src/server/limits.ts`)

| Cap (global, per day) | Default | What it limits in practice |
|---|---|---|
| `global:extract` | 1,000 | New link reads + best-known-spots requests (cached reads count too, since `allowExtract` runs before the cache check for YouTube) |
| `global:place-details` | 300 | **New place names** found on Google (a stored match doesn't count) |
| `global:photos` | 30 | Google photos (Wikimedia first) |
| `global:instagram-reel` | 20 | New Instagram reels read through Apify |
| `global:instagram-transcript` | 1 | Reel transcripts |
| `global:search` | 300 | Autocomplete requests (each typed pause) |
| `global:place-info` | 30 | Place pages with Google rating, hours and reviews |
| `global:city-notes` | 100 | New city notes (Wikipedia + Gemini) |

Per person: 20 link reads an hour, 300 matches an hour, 150 searches an hour. Per network (IP): 60
link reads and 900 matches an hour.

**The host's own limit, found 1 Oct 2026.** EAS Hosting's free plan allows each request **10
outgoing calls** ("subrequests": Google, Wikimedia, Gemini, Apify, each database call) and **10 ms
of processing**; the 11th call fails with "Too many subrequests by single Worker invocation" (seen
in the deployment's Logs as `[limits] consume: …`). The Starter plan ($19 a month) allows 10,000
calls and 30 s. The code plans for the free plan (`src/server/calls.ts`): a place lookup uses at
most 10 (sign-in keys 1, counters and stored match 1, search 1, details 1, save 1, Wikimedia 2,
Google photo up to 3); reading a reel or photo post uses 8, leaving 2 for a slow Apify run or a
Gemini retry; a post's pictures go to Gemini as links, never through our server; and listening to a
reel (about 14 calls) is skipped unless `HOST_CALLS_PER_REQUEST` is set to 20 or more.

**The first real bottleneck is the 300 new place lookups a day.** A new video has up to 100 places
(typically far fewer; a photo post with a multi-day plan can name 60–70, a fifth of the day's allowance). At ~8 new places per video, about **35–40 genuinely new videos a day** use the
whole allowance. After that, new place names fail with `503 quota`. If *every* place in a video
fails, the person sees "We've reached today's limit"; if some were already stored, they get a partial
list. The second bottleneck is **Instagram: 20 new reels a day**, after which reels fall back to "add
them yourself" (`assist: daily_limit`).

### 100 users

| Area | Behaviour |
|---|---|
| Server | Likely fine *if* activity is spread out. If each pastes one new video on the same day, ~800 new place names exceed the 300 Details cap: roughly the first 35–40 videos work fully and later ones fail or are partial. Instagram-heavy use hits the 20-reel cap quickly. |
| Gemini | ~100 calls a day, within the 1,000 extract cap. Gemini's own free-tier limits (requests per minute and per day) are **not in the repo (UNKNOWN)**. When Gemini is busy it answers `429`/`503`, and the code retries twice, then uses the backup model. |
| Database | Tiny load: a few small queries per request |
| Phones | No effect (local) |

### 1,000 users

| Area | Behaviour |
|---|---|
| Daily caps | Hit early every day for new content. Most new videos after the first few dozen fail to match places, and most reels get "add them yourself". Repeat videos and places still work (cached). |
| `global:extract` 1,000 | Reachable: the YouTube path counts cached reads too |
| Per-network limit | People sharing one network (a college or office Wi-Fi, a mobile carrier's shared address) share 60 link reads an hour |
| Hosting | Each paste is 1 + N function calls; ~1,000 users ≈ low thousands of requests a day. EAS Hosting limits: **UNKNOWN from the repo**. |
| Supabase | Every API request makes 1–3 database round trips (rate-limit counting uses one row per bucket per window, and a hot `global:*` row gets an update from every request). Supabase plan limits (connections, requests): **UNKNOWN from the repo**. |
| Realtime | One channel per open shared trip screen. Concurrent connection limits: **UNKNOWN**. |

### 10,000 users

| Area | Behaviour |
|---|---|
| New content | The daily caps dominate: almost everyone pasting something new that day is refused. The service works mainly for videos and places others already added. |
| Hot rows | Every request increments the same `global:*` counters in `api_usage`. Postgres row locking serializes these updates. Whether that becomes slow at this volume is **UNKNOWN** (not measured). |
| Spending | Still ~$0 variable (the caps), apart from anything not capped: **Maps JavaScript API loads** (every web map view), hosting, database and analytics plans |
| Anonymous sign-ins | One per install. Supabase's own limits on anonymous sign-ins: **UNKNOWN from the repo**. |

### 100,000 users

The current design can't serve new content at this scale without raising the caps. Raising them turns
free allowances into real Google, Gemini and Apify spend (see [COST_MODEL.md](COST_MODEL.md)). The
phone half still works. Everything personal lives on each device, so there's no growing central store
of user data. The central tables that grow without limit are `api_matches` (one small row per
distinct place name, never deleted), `api_feedback` (one row per review answer, never deleted) and
`trips` / `members` / `votes` (never deleted).

### Other scaling factors

| Factor | Today |
|---|---|
| Concurrent requests per phone | Place matches run 5 at a time (`MATCH_AT_ONCE`) |
| Long requests | An Instagram read can take up to ~45 s (text) or ~100 s (transcript); the app waits up to 100 s (`EXTRACT_MS`). The host's maximum request duration is **UNKNOWN**. The comment in `instagram.ts` says the call polls in 20 s steps because some runtimes (Expo's dev server) stop outgoing requests at 30 s. |
| Serverless memory | The in-memory fallbacks (`memory` in `src/server/store.ts`, `counts` in `limits.ts`) are only used without Supabase. Production refuses to run without it. |
| Storage growth | `api_extractions` is bounded by 30-day expiry; `api_usage` by 3-day cleanup. Cleanup only runs when someone pastes a link. |
| Bandwidth | Photos load from Google, Wikimedia, YouTube and Instagram servers directly, **not through our hosting**. Our hosting serves the website bundle and small JSON answers. |
| Device storage | The whole trips copy is rewritten on every change (`saveTrips`). The browser's localStorage size limit (typically a few MB; not stated in the repo) caps how much one person can save. When full, saving silently stops (`write()` catches the error). |
| Phone CPU | The planner compares every pair of groups repeatedly, and the planning questions run it once per pace for the "fits K of N" hints. Fine for tens of places; not measured for large collections. |

### Caching that already exists

The phone link cache (30 days); shared video results (30 days); place IDs (forever), coordinates (30
days) and misses (7 days); city notes and best-known spots (30 days); place pages in memory; free
Wikimedia photos before paid ones. See [COST_MODEL.md](COST_MODEL.md).

---

## Part 13: failure scenarios

| Scenario | Expected behaviour | Current implementation | Potential problem |
|---|---|---|---|
| **Gemini fails** (error) | Retry, then a clear message | `generate()`: main model twice (1.2 s gap), then the backup, retrying only on 429/500/503. Then `502 upstream` (or `503 quota` if Google said 429). App: "Something went wrong on our side. Try again." with a Try again button (`upstream` is retryable). | For Instagram, the Apify read was already paid and **isn't saved** when Gemini throws, so a retry pays Apify again |
| **Gemini times out** | Retry or explain | 20 s per attempt. A timeout is **not retried**: `TimeoutError` → `504` "That took too long. Try again." | Worst case ~60 s of retries before failing |
| **Gemini returns bad JSON or nothing** | Treat as a failure | `safeParse()` → null → `places: []`. For YouTube, the result is **saved anyway** (`putExtraction` runs regardless of count). | That video shows "no places" **for everyone for 30 days** after one bad answer |
| **Google Places fails** | Keep what worked | Per place: `upstreamError` → the app counts it as a failure and drops that place. All failed → the first error is shown. Some worked → a partial list. The reading screen notes "N couldn't be found on the map", but only for names past the first few shown (`MoreCredits` in `analysing.tsx`). | A partial list can look complete on the review screen |
| **Place lookup over the daily cap** | Explain | `503 quota` "We've reached today's limit. Try again tomorrow." Not retryable (no Try again button; no fallback server). | Shared by all users; see Part 12 |
| **Video extraction fails** (YouTube private, deleted, blocked) | Explain, don't retry | Empty `items` → `404 video_unavailable` "We can't open this video. It may be private or deleted." Not retryable. | n/a |
| **Invalid URL** | Say so immediately | `parseLink()` runs **on the phone** first → `unsupported_link` "That's not a YouTube or Instagram link." No network call. The server checks again. | n/a |
| **Instagram blocks access / scraper breaks** | Offer another way | `getReel()` never throws: any failure → null → `assist: unreadable` → "Add them yourself" (search), with the reel's thumbnail if known | Not cached, so each retry starts a new paid Apify run (capped at 20 a day) |
| **Instagram not configured** | Offer another way | No `APIFY_TOKEN` → `assist: not_configured` | n/a |
| **YouTube metadata unavailable** (API down or key missing) | Retry later | Down → `502 upstream` (retryable). Missing key → `500 missing_key` (retryable; tries the fallback server if one is set). | n/a |
| **Database fails** | Don't overspend | Rate-limit counting fails **closed**: `unavailable()` → `503` "Something went wrong on our side." Cache reads: logged and treated as a miss. Cache writes: logged, not fatal. Feedback: `502`. Token check fails → `401`. Group: create/join shows "Couldn't reach Xplore's server…". Votes and plan saves fail **silently** (`.catch(() => {})`). | Silent group-save failures leave phones out of step |
| **User loses internet** | Local things keep working | `post()` → `offline` "We can't reach Xplore right now. Check your connection and try again." (retryable). Saved places, **planning** and editing work offline. | No retry queue for shared-trip edits made offline |
| **User closes the app during processing** | Resume or recover | "Keep browsing" / swipe back (app still open): the read continues and lands on Home (`readInBackground`). Killing the app: the phone's request dies. Whether the server run still finishes and saves to `api_extractions` after the client disconnects is **UNKNOWN** (it depends on the host). The planning draft (`state.draft`) is saved, so Home can offer "Continue planning". Pasting again uses the server cache if the result was saved. | n/a |
| **Duplicate video submitted** | Don't pay twice | The phone cache returns it instantly (30 days). Otherwise the server cache: no Gemini or YouTube call. Saving again merges into the same collection (a set). | n/a |
| **Duplicate place extracted** | One place | `cleanPlaces()` drops repeated names (case-insensitive). `toPlaces()` drops two names that resolve to the same Google place ID. A place already saved in another collection stays there (`savedElsewhere`). | Two spellings that Google resolves to *different* IDs (a namesake) both stay |
| **Two users edit the same trip** | Merge, or warn | `savePlan()` writes the **whole** `plan` JSON; realtime pushes it and the other phone replaces its plan (`setTripPlan`). **Last write wins.** Votes can't clash (one row per person per stop). | One person's edit can silently disappear |
| **API rate limit reached** (per person / network) | Explain | `429 rate_limited` "You've added a lot in the last hour. Try again a little later." Not retryable. | Many people on one network share the per-IP limit |
| **Place page over its daily cap** | Degrade | `/api/place` returns `{status:'limited'}`; the page shows without Google's info | n/a |
| **Instagram daily cap reached** | Degrade | `assist: daily_limit` → add by search. The "no places" result isn't saved, so it can retry tomorrow. | n/a |
| **App crash** | Recover | Root `ErrorBoundary` (`src/app/_layout.tsx`) shows a recovery screen; web reloads `/`; the event goes to PostHog | No stack traces are collected anywhere |
