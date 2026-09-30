# How Albin should explain Xplore technically

Answers you can actually say, pitched honestly: Xplore is a well-built **prototype** with a real
server, used by a handful of testers, not a large production system. Each answer is short enough to
say out loud, with the proof in brackets if someone digs in.

---

**1. "What is the tech stack?"**

> It's one TypeScript codebase in Expo, so React Native for iOS and Android, and React Native Web for
> the website, which is what testers use today. The backend is Expo Router API routes in the same
> project, deployed together with the site on EAS Hosting. Supabase gives me Postgres, anonymous
> sign-in and realtime. For the smart parts I use Google Gemini to read video text, Google Places to
> put places on the map, the YouTube Data API, and Apify for Instagram. PostHog handles analytics.

**2. "Explain the architecture."**

> Three layers. The **client** does most of the product: screens, the trips store, saving to the
> device, and the trip planner itself. A thin **server** does only what needs secrets or shared
> caching: reading a video, calling Gemini, matching places on Google, with rate limits in front. The
> **database** holds the server's shared caches and counters, plus shared group trips. Personal data
> stays on the device, because there are no accounts.

**3. "What happens when a user pastes a video?"**

> The app checks the link on the phone first. If it's been read in the last 30 days on that phone,
> it's instant. Otherwise it calls `/api/extract`. The server checks the token and limits, then looks
> in the shared cache. If it's new, it gets the video's text (YouTube's API, or Apify for a reel) and
> sends it to Gemini with strict rules and a JSON schema, and caches the answer for 30 days. The phone
> then calls `/api/match` for each place, five at a time. The server searches Google Places for the
> top hit, gets the coordinates, tries a free Wikimedia photo before a Google one, and caches the
> match. The user confirms each place, Right or Wrong, and saves.

**4. "Where does Gemini fit?"**

> Only at the reading step. Turning free-form captions and descriptions into a clean list of places is
> a language problem, so that's where AI is worth it. It also fills in general knowledge like typical
> visit time and best part of the day, and it's told to return null when it doesn't know. It's also
> used for a city's best-known spots and for condensing Wikipedia into city notes. All of it is cached.

**5. "Why isn't Gemini generating the itinerary?"**

> Because itineraries are mostly arithmetic: minutes, kilometres, what fits in a day. LLMs aren't
> reliable at that. Rules are instant, free, work offline, give the same answer every time, and I can
> test them. The planner sits behind an interface, so an AI engine could be swapped in, but today it's
> rules on purpose. Honestly, the rules still have gaps I've found in testing, like long waits
> between parts of the day, and that's the next thing I'm working on.

**6. "How does your backend work?"**

> It's nine small endpoints written as Expo API routes: plain functions that take a request and
> return JSON. Every route follows the same pattern: check the Supabase token, count the request
> against per-user, per-network and global daily limits, do the work, and return either the data or
> a typed error with a human-readable message. One log line per request with timings, and no personal
> data in logs.

**7. "Where is the data stored?"**

> Two places. Personal data lives on the device: saved places, plans, name, all as one JSON copy in
> localStorage, which on phones is backed by SQLite. The cloud has Supabase tables: shared caches for
> video results and place matches, usage counters, review feedback, and group trips with members and
> votes. That's a trade-off I made for speed and privacy. The downside is there's no backup if you
> clear your browser.

**8. "How does authentication work?"**

> There's no sign-up. The first time the app needs the network, it signs in anonymously with Supabase,
> so every install gets a random ID and a token. The server verifies that token on every request and
> uses the ID for rate limits. For group trips, Postgres row-level security means only members can see
> a trip, and you only become a member by creating it or knowing its six-letter code.

**9. "What APIs do you use?"**

> Gemini; YouTube Data API v3; Google Places API (New): Text Search, Place Details, Photos and
> Autocomplete; the Google Maps JavaScript API for the web map; Apify's Instagram Reel Scraper;
> Wikipedia, Wikivoyage and Wikimedia Commons for free photos and city facts; Supabase; and PostHog.
> No routing API: travel times are estimated.

**10. "How does the planner work?"**

> Each pace has a day budget, for example Balanced is at most four stops or eight hours including
> travel. Every place starts as its own group, and I repeatedly merge the two groups that make the
> shortest combined day, until there's one group per trip day or nothing else fits. Leftovers try to
> squeeze into any day, or get listed with a reason. Each day is ordered morning, afternoon, then
> evening, nearest stop next. Travel time is straight-line distance times a detour factor for the
> terrain, divided by a typical speed for walking, autos, car or bus. Reshuffle just changes the random
> seed for tie-breaks.

**11. "What happens if an API fails?"**

> Each failure has a code and a message written for people. Gemini retries twice and then falls back
> to a second model. A Google failure drops that one place, not the whole video. An Instagram reel we
> can't read falls back to adding places by search, and a video with no named places offers the city's
> best-known spots. The limits fail closed: if the counter database is down, we refuse rather than
> risk spending. Planning works offline because it's local.

**12. "How would you scale this to 100,000 users?"**

> Honestly, today it's designed to stay free, not to scale. There are hard daily caps under Google's
> free allowances, like 300 new place lookups a day, so new content would run out first. The good news
> is the expensive work is shared: a video or place is paid for once and cached for everyone, and
> planning costs nothing because it runs on the phone. Scaling would mean raising those caps with a
> budget, moving user data to accounts in the cloud, and adding monitoring. I haven't built that yet.

**13. "What does one user's trip roughly cost?"**

> Right now, effectively zero in variable cost, by design. A new video is one Gemini call on the free
> tier, one YouTube call, and a Google lookup per new place inside the free monthly allowance. An
> Instagram reel adds about a third of a cent on Apify. Planning is free. A repeat video costs nothing
> external. I haven't verified current paid prices, so I wouldn't quote a paid-tier number.

**14. "How would you reduce API costs?"**

> Most of it is already in place: 30-day shared caches, place IDs kept forever, the cheapest Google
> field tiers (IDs-only search, Essentials details), free Wikimedia photos before Google's,
> autocomplete session tokens, transcripts only when a reel's text names nothing, and daily caps. Real
> token counts per video are already stored, so any next step would start from measured numbers.

**15. "How would you deploy this to production?"**

> The website and API deploy together: I build with `expo export`, deploy to a preview URL, check it,
> then promote to production on EAS Hosting. Secrets live in EAS environment variables, and the
> database schema is SQL I run in Supabase. For the App Store and Play Store I'd add EAS Build
> profiles, bundle IDs, signing, and a native map. That part isn't set up yet, and there's no CI.

---

## Things to be careful not to overclaim

- It's a **web app in real use**, with native apps that run in development only (no store builds).
- **No server-side user accounts**: data is per device.
- **No routing API**: travel times are estimates.
- **No automated tests or CI.**
- The planner is **deterministic rules**, not AI, and it has known quality issues.
- Prices in the code are the developer's notes; current provider pricing hasn't been verified.
