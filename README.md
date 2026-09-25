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

## The happy flow

1. **Onboarding** → three screens: what it does, what it does near home, and which district you live in.
2. **Home** → paste a link, or tap a sample city.
3. **Analysing** → the reel is read and places roll in like film credits.
4. **Save** the spots and keep collecting, or **Plan this trip** to go straight on.
5. **Reveal** → the city map, with photo pins dropping in.
6. **Review** → swipe right to keep, left to skip; the room behind the cards becomes the place you're looking at. Undo, or *Keep the rest*.
7. **Plan** → the route draws itself, and scrolling the day moves the map. Add a local pick, then *Save this day*.
8. **Map tab** → every spot you've saved, split into *Near home* and *Away*, with ready-made weekend outings for the near ones.
9. **Profile** → home district, permissions, and **Simulate arrival** to see the notification flow.

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
