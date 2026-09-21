# Raahi — prototype

*Turn the reels you saved into a trip you'll actually take.*

A proof of concept for iOS and Android built with Expo. There's no backend: link extraction runs against canned data (Gokarna, Kochi, Meghalaya) behind a mock API in `src/data/api.ts`, shaped so a real service can replace it.

Design system, motion specs and microinteractions: [DESIGN.md](DESIGN.md).

## Run it on your iPhone (free, no Apple Developer account)

1. Install **Expo Go** from the App Store.
2. Start the dev server:
   ```bash
   npx expo start
   ```
3. Scan the QR code with the iPhone Camera app. Your phone and Mac must be on the same Wi-Fi. If they aren't, run `npx expo start --tunnel`.

Android: install Expo Go from the Play Store and scan the QR code from inside Expo Go.

Motion and haptics are only representative on a real phone, not in the web preview.

## The happy flow

1. **Home (empty)** → *Try a sample link*, or paste any Instagram / YouTube link.
2. **Analysing** → the reel is read and places roll in like film credits.
3. **Reveal** → the Gokarna map, with photo pins dropping in.
4. **Review 7 places** → swipe right to keep, left to skip. You can undo, or use *Keep the rest*.
5. **Plan** → the route draws itself, and scrolling the day moves the map. Add the local dinner pick, then *Save this day*.
6. **Home (collection)** → your city with "Day planned".

A link containing `kochi` or `meghalaya` loads that city. Any other link is hashed to one of the three sets.

## Structure

```
src/app/          screens (Expo Router): index, paste, analysing, city/[id], pick/[id], plan/[id], place/[id]
src/components/   CityMap (stylised map + camera), PlaceCard, PhotoCard (glass rim), Button, …
src/data/         catalog (canned cities/places/reels), api (mock), plan (day builder)
src/state/        trips store (collections, keep/skip, added local picks)
src/lib/          motion tokens, haptics, geo helpers
src/theme/        colour, type and radius tokens
```

Photo credits: [CREDITS.md](CREDITS.md).
