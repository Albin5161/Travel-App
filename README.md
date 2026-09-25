# Xplore — prototype

*Formerly Raahi.*

*Turn the reels you saved into a trip you'll actually take — and the spots near home into your weekends.*

A proof of concept for iOS and Android built with Expo. There's no backend: link extraction runs against canned data (Kottayam, Kochi, Gokarna, Meghalaya) behind a mock API in `src/data/api.ts`, shaped so a real service can replace it without touching the screens.

Design system, motion specs and microinteractions: [DESIGN.md](DESIGN.md).

## Two halves

**Collect and plan.** Paste an Instagram or YouTube link. Every place in it is pulled out, named, described and pinned. Keep the ones you want, and the day plans itself.

**Home and weekends.** Spots you save near where you live don't become a pin graveyard. They're clustered by proximity into ready-made outings with the drive time worked out — and arriving in a district you've saved spots in gets you *one* notification naming them, not a ping for every café you pass.

## Run it on your iPhone (free, no Apple Developer account)

1. Install **Expo Go** from the App Store.
2. Start the dev server:
   ```bash
   npx expo start
   ```
3. Scan the QR code with the iPhone Camera app. Your phone and Mac must be on the same Wi-Fi. If they aren't, run `npx expo start --tunnel`.

Android: install Expo Go from the Play Store and scan the QR code from inside Expo Go.

Motion and haptics are only representative on a real phone, not in the web preview.

### What needs a development build

Two things can't run in Expo Go, and both have a working stand-in:

| Not in Expo Go | Stand-in |
|---|---|
| Background geofencing (real arrival detection) | **Simulate arrival** in Profile runs the identical path |
| Lock-screen notifications | The same message appears as an in-app banner |

Everything else — the whole flow, the maps, the motion — works in Expo Go.

## Planning together, for real

Out of the box the group vote is a scripted demo (Riya, Kabir, Meera). Connect the free Supabase backend and two phones can plan the same trip: one shares, the other joins with the link or a six-letter code, and every join, vote, note and added stop shows up on both, live.

1. In this folder, run `npx eas-cli@latest integrations:supabase:connect`. It opens your browser to sign in to Supabase, creates the project, and writes `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local` (git-ignored; both are public by design).
2. In the Supabase dashboard, open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. In **Authentication → Sign In / Providers**, turn on **Anonymous sign-ins**. Nobody makes an account: each phone or browser is its own person.
4. Restart `npx expo start` so the new keys are picked up.

How it fits together: `src/lib/live/` talks to Supabase (the client, the calls, and the wire format that sends places as catalog ids, since photo asset ids differ between builds). `src/state/live.tsx` listens to a shared trip and turns what arrives into the same store actions the scripted demo dispatches, so every screen works either way. Trips are private to their members by row level security; the only way in is making the trip or knowing its code.

## The happy flow

1. **Onboarding** → four screens, each with a looping illustration: a video (a beach, a restaurant, a hidden spot) becoming pins on a map and a planned day, the group vote, weekends near home (with the district picker), and your name as friends will see it.
2. **Home** → paste a link, or tap a sample city.
3. **Analysing** → the reel is read and places roll in like film credits.
4. **Save** the spots and keep collecting, or **Plan this trip** to go straight on.
5. **Reveal** → the city map, with photo pins dropping in.
6. **Review** → swipe right to keep, left to skip; the room behind the cards becomes the place you're looking at. Undo, or *Keep the rest*.
7. **Plan** → the route draws itself, and scrolling the day moves the map. Add a local pick, then *Save this day*.
   - **Share** → the stamp lands, then "Your Xplore plan is ready": the plan as a boarding pass that tilts with your phone. *Share to group* sends it as an image with a link.
   - **Who's going** (the first planning question) → solo, partner, friends or family decides whether there's a vote and who's in it.
   - **Group vote** → friends join and keep, swap or drop each stop; an overruled stop flips to its swap, and confetti when everyone agrees. *Vote as a friend* lets someone vote on your phone. *Lock it in* applies the result. The shared link opens the same vote on the web build.
8. **Trips tab** → every saved plan, who's in, and the vote's status, updating live.
9. **Map tab** → every spot you've saved, split into *Near home* and *Away*, with ready-made weekend outings for the near ones.
10. **Profile** → home district, permissions, and **Simulate arrival** to see the notification flow.

A link containing `kottayam`, `kochi`, `gokarna`, `meghalaya`, `shillong` or `dawki` loads that set. Any other link is hashed to one of the four.

## Structure

```
src/app/          screens (Expo Router)
                    (tabs)/  index (Collect) · map (saved spots) · profile
                    onboarding, analysing, city/[id], citymap/[id],
                    pick/[id], plan/[id], place/[id]
src/components/   CityMap (stylised map + camera), CityTile, CityHero, TabBar,
                    pick/AmbientBackdrop, plan/TabIcon, spots/*, PhotoCard, Button, …
src/data/         catalog (canned cities/places/reels), regions (Kerala region map),
                    cityInfo (Plan-panel data), api (mock), plan (day builder)
src/state/        trips store, arrival (geofence wiring), where (location)
src/lib/          spots (clusters, weekend routes, filters), arrival (geofencing +
                    notifications), motion tokens, haptics, geo helpers
src/theme/        colour, type and radius tokens
```

The maps are hand-drawn SVG rather than a tile provider, so pins drop and the camera flies on the UI thread. That doesn't scale past demo cities — a real build would swap in MapLibre with a style matching the same palette.

## Checks

```bash
npx tsc --noEmit    # types
npx expo lint       # lint
npx expo-doctor     # dependency and config health
```

## Caveats

- **All state is in memory.** Saved spots and plans reset when the app restarts.
- **Kottayam's photography is placeholder** — real places, borrowed images. See [CREDITS.md](CREDITS.md).
- Sample data throughout: ratings, reviews, costs and safety signals are illustrative, not sourced.

Photo credits: [CREDITS.md](CREDITS.md).
