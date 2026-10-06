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
- **One base.** Every day starts and ends where you're staying. A place too far for a day trip
  (Pangong or Nubra from Leh) is left out with "it needs a night nearby"; planning the night away
  is a later step.
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
