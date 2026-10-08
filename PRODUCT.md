# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Anyone, anywhere, who saves travel videos and wants to turn them into a trip (confirmed by Albin, 7 Oct 2026). Not limited to India or to one age group. They arrive holding a link to a reel or video they already saved, usually on their phone, and want to know what places are in it and how to visit them.

Today's testers are Albin and Akku.

## Product Purpose

Xplore turns the travel videos a person saved into a trip they actually take. Paste an Instagram reel or a YouTube link; Xplore finds every place in it, puts the places on a map, and plans the days. A plan can be kept alone or shared so friends vote on each stop.

Success is a saved video becoming a planned trip, and a planned trip being taken.

## Positioning

The way in is always a video the person already saved, never a catalogue of destinations to browse (confirmed as the one thing that must stay true, 7 Oct 2026).

## Operating Context

- Used on a phone, often straight after watching a reel, with the link on the clipboard or sent through the share sheet.
- One Expo codebase builds iPhone, Android and the web. Xplore is a phone app first; the website at xplore.expo.app is the stand-in that is live today, and it is tested on phones through Expo Go. No App Store or Play Store builds exist yet.
- Places are filed by city, and split into "Near Home" and "Cities".

## Capabilities and Constraints

- Reads Instagram reels, Instagram photo posts and YouTube videos into a list of places; up to five links per paste.
- Places appear on a map; the planner builds day plans on the device with plain rules (no AI) and works offline.
- Group trips: share a plan and friends vote on stops.
- A share ticket and recap for a trip.
- No user accounts today: each install signs in anonymously, and saved places and plans live in device storage. Location is worked out on the phone and not sent anywhere. These are how the app works now, not confirmed commitments.
- Runs on free tiers: EAS Hosting's free plan allows about 10 outgoing calls per request, and Google lookups and photos have daily caps.
- A real share-sheet entry, a native Google map and store builds all need a development build and an Apple developer account, which are not set up.
- Undecided: whether the app stays free, and whether accounts are ever added.

## Brand Commitments

- Name: Xplore (formerly Raahi). Logo is in `assets/images`.
- Mascots: Amma and the child appear on every loading wait and every extraction error.
- Words are plain and short.

## Evidence on Hand

- Place photos in `assets/images/places`, with credits in `CREDITS.md`.
- Sample video links built into the app for trying it without a real link.
- 31 hand-drawn craft patterns, one per Indian state, in `src/lib/patterns.ts`. Places outside India fall back to one shared pattern.
- No testimonials, user numbers, press or reviews exist. Do not invent any.

## Product Principles

1. Start from the person's own saved video, every time.
2. One clear next step on each screen.
3. The person's own places and plans come before anything the app wants to say.
4. Say it in plain words.
5. Don't spend the person's data or the project's paid calls without need.

## Accessibility & Inclusion

WCAG AA colour contrast on every screen, and tap targets of at least 44pt.
