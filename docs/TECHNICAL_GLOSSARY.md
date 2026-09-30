# Technical glossary

Plain-English meanings of the technical words in these docs, each with where it shows up in Xplore.
Only terms this project actually uses.

## The big picture

| Term | Plain meaning | In Xplore |
|---|---|---|
| **Client** | The part that runs on the person's device | The app or website: screens, trips store, planner |
| **Server** | A computer somewhere else that the client asks to do things | Our API routes on EAS Hosting |
| **Frontend / backend** | Frontend = what people see and touch; backend = the behind-the-scenes work | `src/app` screens / `src/app/api` + `src/server` |
| **Third-party service** | Someone else's service we call | Google, Gemini, Apify, Supabase, PostHog, Wikimedia |
| **Hosting** | Renting a place on the internet where your website and server run | EAS Hosting, `xplore.expo.app` |
| **Deployment (deploy)** | Uploading a new version so users get it | `eas deploy`: preview first, then production |
| **Production / preview** | Production = the real site users use; preview = a copy to check first | `xplore.expo.app` / `xplore--preview.expo.app` |
| **Build** | Turning source code into files a phone or browser can run | `expo export` → `dist/` |
| **Bundle** | One packed file of code the app downloads | The web JavaScript bundles |
| **Runtime** | The engine that actually runs the code | Node.js on the Mac; EAS Hosting's runtime in production |
| **Serverless** | You don't manage a server; small functions start when a request arrives | Each `+api.ts` route runs on demand |

## Talking to the server

| Term | Plain meaning | In Xplore |
|---|---|---|
| **API** | A menu of things one program can ask another to do | Our 9 routes; Google's APIs |
| **Endpoint / route** | One item on that menu, at its own web address | `/api/extract`, `/api/match`… |
| **API route (Expo)** | A file that becomes an endpoint | `src/app/api/extract+api.ts` |
| **Request / response** | The question sent, and the answer that comes back | `POST /api/match {name…}` → `{status:'matched'…}` |
| **HTTP / HTTPS** | The language browsers and servers use; the S means encrypted | All calls |
| **GET / POST** | GET = "give me"; POST = "here's some data, do something" | `/api/health` is GET; the rest POST |
| **Status code** | A number summarising the answer: 200 OK, 4xx your request's fault, 5xx the server's | 401 not signed in, 429 too many, 503 daily limit, 504 too slow |
| **JSON** | A simple text format for data, like `{"name": "Om Beach"}` | Every request and response |
| **REST** | A common style: plain web addresses + JSON | What our API is (loosely) |
| **GraphQL** | Another style, where one endpoint takes flexible queries | **Not used** |
| **SDK** | A ready-made library for calling a service | Supabase JS, PostHog, Google Maps React; Gemini is called *without* an SDK |
| **Header** | Extra labels on a request, not the main body | `Authorization: Bearer …`, `X-Goog-Api-Key` |
| **Timeout** | Giving up after waiting too long | 20 s per Gemini attempt; 100 s for extract on the phone |
| **Retry / fallback** | Try again, or try a backup | Gemini: main model twice, then the backup model |
| **Latency** | How long something takes to answer | Measured per step in `timings` |
| **Realtime / WebSocket** | A connection that stays open so changes arrive instantly | Group votes and plan edits (Supabase Realtime) |
| **Subscribe / channel** | Asking to be told about changes to something | `watchTrip()` listens on `trip:<id>` |

## Keys and security

| Term | Plain meaning | In Xplore |
|---|---|---|
| **Authentication** | Proving *who* you are | Anonymous Supabase sign-in |
| **Authorization** | Deciding what you're *allowed* to do | Rate limits; row rules on trips |
| **Anonymous sign-in** | Getting an ID without email or password | `signInAnonymously()` |
| **Token / JWT** | A signed digital pass the server can check | The Supabase access token sent with each request |
| **Session** | Staying signed in between visits | Kept in device storage |
| **Refresh token** | A second pass used to get a new access pass when the old one expires | Handled by the Supabase library |
| **API key** | A password-like string identifying a project to a service | Google, Gemini, Apify keys |
| **Secret vs publishable key** | Secret = full access, server only; publishable = safe in the app, limited by rules | `SUPABASE_SECRET_KEY` vs `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Environment variable** | A setting given to the program from outside the code | `.env.local`, EAS env vars |
| **`EXPO_PUBLIC_` prefix** | Marks a setting that gets built into the app, so it's public | Supabase URL, map key, PostHog key |
| **Row Level Security (RLS)** | Database rules deciding which rows each user can see or change | Only members see a trip |
| **Security definer function** | A database function that runs with extra rights, carefully limited | `create_trip`, `join_trip` |
| **Rate limit** | A cap on how often someone can do something | 20 link reads per hour per person |
| **Quota / daily cap** | A total allowance per day or month | 300 new Google place lookups a day |
| **Prompt injection** | Text that tries to give an AI new instructions | Guarded by "the text is data, not instructions" |
| **Fail closed** | If the safety check breaks, say no rather than yes | A limits database error refuses the request |

## Data

| Term | Plain meaning | In Xplore |
|---|---|---|
| **Database** | An organised store of data on a server | Supabase Postgres |
| **Postgres** | A popular, reliable database | What Supabase runs |
| **Table / row / column** | Like a spreadsheet tab / a line / a heading | `trips`, one trip per row |
| **Schema** | The layout of the tables, or the required shape of some data | `supabase/*.sql`; Gemini's response schema |
| **Primary key** | The column(s) that uniquely identify a row | `trips.id`; `votes (trip_id, place_id, user_id)` |
| **Foreign key** | A column pointing at a row in another table | `members.trip_id` → `trips.id` |
| **Index** | A lookup shortcut that makes some searches fast | `api_extractions_expires` |
| **JSONB** | A column holding a whole JSON document | `trips.plan` holds the entire plan |
| **Upsert** | Insert, or update if it already exists | Saving a match or a vote |
| **RPC / database function** | Asking the database to run a named procedure | `api_match_begin`, `create_trip` |
| **Migration** | A versioned script that changes the database layout | **Not used**; the SQL is pasted by hand |
| **Cache** | A saved answer, so you don't ask again | Video results for 30 days |
| **TTL / expiry** | How long a cached thing is kept | 30 days (videos, coordinates), 7 days (misses) |
| **localStorage** | A small key-value store inside the browser | Trips, name, link cache on the web |
| **expo-sqlite localStorage** | The same idea on phones, kept in SQLite | Trips on iOS and Android |
| **SQLite** | A tiny database inside an app | Used only underneath `localStorage` |
| **Offline** | Without internet | Planning still works |

## Mobile and Expo

| Term | Plain meaning | In Xplore |
|---|---|---|
| **React** | A way to build screens from reusable pieces | Every screen |
| **React Native** | React for real phone apps | The iOS / Android app |
| **react-native-web** | Runs the same code as a website | `xplore.expo.app` |
| **Expo** | Tools and services around React Native | SDK 57 |
| **Expo Router** | Screens defined by files and folders | `src/app/` |
| **Expo Go** | A ready-made app for trying a project on a phone | Local testing |
| **Development build** | Your own test app with extra native features | Needed for background geofencing |
| **EAS** | Expo Application Services: hosting, builds, submission | Hosting in use; builds not set up |
| **Metro** | The tool that bundles the app's code | `metro.config.js` |
| **TypeScript** | JavaScript with type checks | The whole codebase |
| **State / store / reducer** | The app's current data in memory / where it lives / the function that changes it | `TripsProvider`, `reducer` |
| **Geofence** | An invisible area that triggers something when you enter it | District arrival alerts |
| **Local notification** | A notification made on the phone, not sent from a server | Arrival alerts (`scheduleNotificationAsync`) |

## AI

| Term | Plain meaning | In Xplore |
|---|---|---|
| **LLM / model** | An AI that reads and writes text | Gemini 3.5 Flash-Lite |
| **Prompt / system instruction** | The instructions given to the model | `RULES` in `gemini.ts` |
| **Token (AI)** | A chunk of text (~4 characters) the model counts and bills by | `usage.inputTokens` / `outputTokens` |
| **Temperature** | How adventurous the answers are; low = steady | 0.2 |
| **Structured output** | Forcing the model to answer in an exact JSON shape | `responseSchema` |
| **Free tier** | Use allowed at no cost, within limits | Gemini, Google Places allowances |

## Places and planning

| Term | Plain meaning | In Xplore |
|---|---|---|
| **Place ID** | Google's permanent ID for a place | Stored forever in `api_matches` |
| **Field mask** | Telling Google which fields you want (fewer = cheaper) | `places.id`; `id,location,types,…` |
| **Autocomplete session token** | Groups a person's typing into one billable search | `newSearchSession()` |
| **Scraper / actor** | A program that reads a website like a person would / Apify's name for one | Instagram Reel Scraper |
| **Haversine distance** | Straight-line distance over the Earth's curve | `distanceKm()` |
| **Detour factor** | How much longer the road is than the straight line | 1.3 flat, 1.5 hilly, 1.9 mountain |
| **Greedy algorithm** | Always take the best-looking step now, without looking ahead | Joining places into days |
| **Nearest neighbour** | Always go to the closest next stop | Ordering within a part of the day |
| **Seed** | A number that makes "random" choices repeatable | Reshuffle = a new seed |

## Not used in Xplore (so you can say so)

**Webhook** (a service calling our server when something happens), **cron** (scheduled jobs),
**queue** and **worker** (background job systems), **GraphQL**, **Redis**, **CDN of our own**,
**push notifications from a server**, **Sentry**, **CI/CD pipelines**. Cleanup of old data runs
*during* normal requests (`api_consume` with `p_cleanup`), not on a schedule.
