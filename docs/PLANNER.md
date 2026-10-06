# The trip planner

Traced from `src/data/planner.ts`, `src/data/planner/schedule.ts`, `src/data/planner/build.ts` and
`src/server/gemini.ts`, October 2026.

## Who does what

**Gemini understands places. Google verifies them. The planner decides the trip. Xplore explains it.**

- **Gemini** (server, when a link is read) returns facts about each place: what kind it is, the
  meal it's for, when it's at its best, whether people go for the sunset, sunrise or after dark,
  how long a visit takes, its area and the wider area that's part of. It is never asked for a day
  or an order, and never plans.
- **Google Places** gives each place its real location.
- **The planner** is plain rules on the phone. The same places, answers and seed always give the
  same plan. No model and no network call is involved in planning.
- **The explanations** (`src/data/why.ts`) are read off the finished plan, so they stay true after
  an edit.

## How a plan is made

1. **One day on the clock** (`schedule.ts`). For the places on a day, orders are tried and a clock
   is walked through each: travel, then the visit. At each stop the day either starts straight away
   or waits for a better moment, whichever costs less. Lunch is about 12–2, dinner about 7–9, a
   sunset place is timed so the sun goes down while you're there (the app's own sun maths,
   `src/lib/sun.ts`). A day sets out at the earliest time that makes sense.
2. **Which places share a day** (`build.ts`). Several whole trips are put together in different
   ways, each is improved by moving and swapping places, and the one that scores best is kept.
3. **Hard limits** (never broken): locked places stay on their day; removed places stay out; a
   place without a location isn't scheduled; a day stays within the pace's hours of seeing and
   getting around (6, 8 or 10, with a tenth to spare), its latest end, and a limit on time on the
   road (six tenths of those hours).
4. **Preferences** (traded against each other), in order: fit as many saved places as the days
   honestly hold; each place at a good time; meals at mealtimes; sunsets at sunset; one part of
   town per day; little travel and no doubling back; no long unexplained waits; a comfortable
   number of stops. The number of stops is never a limit.
5. **Left-out places** each get a reason worked out from what adding them would really do.

## Nights away from the base

A trip is a journey: where you sleep tonight decides what you can reach tomorrow.

- **The model.** A plan may carry `nights`: one entry per night, either the base (null) or a named
  point to sleep at (`{ name, coords }`: a place to measure from, not necessarily a hotel). Day *d*
  starts where night *d − 1* was spent and ends where night *d* is; the last day ends at the base.
  With no `nights` (every older plan, and every plan that sleeps at the base throughout) each day
  goes out from the base and back, exactly as before.
- **Where a night could be** (`nights.ts`). Saved places that can't be visited and come back from
  in a day are grouped with the places near them (within about 75 minutes of each other). Each
  group is a possible night, named from the area its places share.
- **Trying them.** The trip is planned with a night at each of the two biggest groups on each
  evening it could fall, and with both on two evenings in either order. Each is scored like any
  trip, plus a cost for every night away and more for a second different bed.
- **The traveller decides.** The plan handed back always keeps the traveller's base. If the best
  trip with nights away is meaningfully better after those costs, it is attached as `offer`, with a
  title and a reason built from the planner's own estimates. The plan screen shows it as a card:
  keep the base, or plan it that way. Accepting replans with those nights; declining hides it.
- **Limits that change.** A day that moves on to another bed may be mostly a drive (the road-share
  limit applies only to days that go out and come back); the pace's hours and latest end still hold.
  A day with nothing to see but the drive is shown as a travel day.
- **What it doesn't do.** It only suggests a night where something is out of a day's reach: a place
  that is merely a long day trip is planned as one. At most two different beds away are tried. It
  doesn't know roads: Nubra to Pangong is driven in about five hours by a direct road, but by
  distance and terrain it estimates nearly nine, so it routes that trip back through the base.

## Places saved before the new facts

The finer facts were added in October 2026. A place read before that has none, and so does any
link whose result is still kept (30 days) on the server or on the phone. Nothing breaks and nothing
needs re-importing: for those places the planner goes by the kind of place, its best part of the
day, and its name and "why" line, as before. A link gets the new facts the next time it is read
fresh.

## Known limits

- **Travel times are estimates.** Straight-line distance, stretched for the terrain and divided by
  a speed for how you're getting around. No routing service is used, so a ferry (Elephanta Island),
  a one-way system or a mountain pass that's closed isn't known. The plan says "about".
- **Opening hours aren't used.** Google's terms don't allow storing its hours, and no Google call is
  made while planning. The planner never claims a place is closed.
- **Nights away are suggested, never imposed**, and only from estimated distances (see above).
- **Gemini's facts are its general knowledge**, not checked, and it can answer differently on
  another day. So they are preferences, never rules: no fact can drop a place or break a day.
  - *What a place is* (kind, meal type, area) and *when to go* (best time, "also good at sunset /
    sunrise / after dark") are kept apart. "Dessert" doesn't mean evening; "lunch" doesn't mean noon.
  - Only a **best time of sunset** claims the sunset hour. "Also good at sunset" is weaker: the place
    keeps its own best time, and may take the sunset if it happens to be passing.
  - One confidence number comes with the timing answers; the lower it is, the more loosely a place
    is held to them (down to half). In practice the model says 0.9 for nearly everything, so this
    softens little: the real protection is that every timing fact is soft.
- **Scoring weights are judgement**, tuned on the test trips in `tests/planner/`.

## Checking it

```bash
npm run test:planner          # the tests
npm run planner:compare       # old planner, today's without facts, today's with Gemini's facts
npm run planner:record-facts  # ask the real model about the test places again (six free-tier calls)
```
