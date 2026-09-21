---
name: Raahi
description: Turn the reels you saved into a trip you'll actually take — a travel film at dusk, where photography talks and the UI recedes into dark glass.
colors:
  night: "#0D0F0E"
  basalt: "#1B1D1A"
  basalt-raised: "#242622"
  olive: "#545A45"
  stone: "#8A8574"
  ash: "#9B9B9B"
  mist: "#EEEAE3"
  ember: "#E2763C"
  glass-light: "rgba(255,255,255,0.14)"
  glass-dark: "rgba(13,15,14,0.38)"
  rim: "rgba(255,255,255,0.16)"
  hairline: "rgba(255,255,255,0.08)"
typography:
  display-xl:
    fontFamily: "Instrument Serif"
    fontSize: 56
    fontWeight: 400
    lineHeight: 56
  display:
    fontFamily: "Instrument Serif"
    fontSize: 40
    fontWeight: 400
    lineHeight: 42
  headline:
    fontFamily: "Instrument Serif"
    fontSize: 28
    fontWeight: 400
    lineHeight: 32
  serif-italic:
    fontFamily: "Instrument Serif Italic"
    fontSize: 22
    fontWeight: 400
    lineHeight: 28
  body:
    fontFamily: "Geist"
    fontSize: 15
    fontWeight: 400
    lineHeight: 22
  body-strong:
    fontFamily: "Geist"
    fontSize: 15
    fontWeight: 500
    lineHeight: 22
  label:
    fontFamily: "Geist"
    fontSize: 13
    fontWeight: 500
    lineHeight: 18
  micro-caps:
    fontFamily: "Geist"
    fontSize: 11
    fontWeight: 600
    lineHeight: 14
    letterSpacing: 2
rounded:
  thumb: 14
  card: 28
  sheet: 32
  pill: 999
spacing:
  xs: 4
  sm: 8
  md: 12
  lg: 16
  xl: 24
  xxl: 32
  gutter: 24
motion:
  ease-out: "cubic-bezier(0.23, 1, 0.32, 1)"
  ease-in-out: "cubic-bezier(0.77, 0, 0.175, 1)"
  ease-sheet: "cubic-bezier(0.32, 0.72, 0, 1)"
  press: 120
  small: 180
  ui: 260
  ui-max: 300
  cinematic: 450
  spring-settle: { duration: 400, dampingRatio: 1 }
  spring-drag: { duration: 400, dampingRatio: 0.8 }
  spring-sheet: { duration: 300, dampingRatio: 0.8 }
  spring-land: { duration: 500, dampingRatio: 0.72 }
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.night}"
    rounded: "{rounded.pill}"
    height: 56
  button-secondary:
    backgroundColor: "{colors.glass-light}"
    textColor: "{colors.mist}"
    rounded: "{rounded.pill}"
    height: 56
  pill-on-photo:
    backgroundColor: "{colors.glass-dark}"
    textColor: "{colors.mist}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  pill-on-dark:
    backgroundColor: "{colors.glass-light}"
    textColor: "{colors.mist}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  photo-card:
    backgroundColor: "{colors.basalt}"
    rounded: "{rounded.card}"
---

# Design System: Raahi

## Overview

**Creative North Star: "A travel film at dusk."**

Raahi should feel like the opening minutes of a travel film shot at golden hour. The photograph does the talking. The interface steps back into dark glass and gets out of the way. The mood is calm, warm and premium, and it's the opposite of the busy, list-heavy trip planners Raahi competes with. Depth comes from light, photography and glass, never from decoration.

The system is **dark-only**. Night (`#0D0F0E`) is the world every screen lives in. Warmth enters only through photography; the UI itself stays neutral, with one accent (Ember) reserved for the moments the user acts: keep, route, go.

The craft bar is **CRED / Swiggy / Zomato-level motion**. Everything that moves has a reason, runs on the UI thread, and can be interrupted by a finger.

**Key characteristics**
- Full-bleed photography that dissolves into Night instead of sitting on it
- Dark glass: a glass rim on photo cards, tinted pills that stay readable on any image
- Two voices: an editorial serif for places and moments, a quiet grotesque for everything functional
- One accent, Ember, meaning "act here"
- Two speeds of motion: instant UI, cinematic storytelling (see Motion)

Visual references and the decision trail live in the Figma file *Raahi — Reference Moodboard*, page "02 · Visual Direction".

## Colors

### Accent
- **Ember** (`#E2763C`): the only colour in the UI. Keep, the primary button, the route line, the active pin ring, the "you are here" in a plan. If something is Ember, the user can act on it or is looking at their own choice. Text on Ember is Night.

### Neutrals
- **Night** (`#0D0F0E`): every screen's background, and the colour every photo gradient ends in.
- **Basalt** (`#1B1D1A`): sheets, cards without photos, the itinerary panel.
- **Basalt Raised** (`#242622`): pressed and nested surfaces on Basalt.
- **Olive** (`#545A45`): the back cards of the Pick stack, map land.
- **Stone** (`#8A8574`): secondary body text on dark.
- **Ash** (`#9B9B9B`): micro-caps, meta, timestamps, counters. It replaced Sand so the UI carries no warmth of its own.
- **Mist** (`#EEEAE3`): primary text on dark and on photos.

### Glass
- **Glass Light** (white 14%): pills and secondary buttons over dark UI.
- **Glass Dark** (Night 38%): pills over photography.
- **Rim** (white 16%): hairline edge on glass and on photo cards.
- **Hairline** (white 8%): dividers.

### Named rules
**The Warmth-From-Photos Rule.** The UI never adds warm colour. If a screen feels cold, the fix is a better photo, not a beige surface.

**The One-Accent Rule.** Ember is the only non-neutral colour. No success green, no info blue. State is carried by Ember vs neutral, by copy, and by motion.

## Typography

**Display:** Instrument Serif (Regular, Italic)
**Interface:** Geist (400, 500, 600)

**Character:** a warm, high-contrast editorial serif for *places and moments*, and a neutral, precise grotesque for *everything you operate*. You can tell what's content and what's control before you read it.

### Hierarchy
- **Display XL** (Instrument Serif 56/56): place names on the Pick card, city names on photo cards.
- **Display** (Instrument Serif 40/42): screen titles, e.g. "Gokarna".
- **Headline** (Instrument Serif 28/32): day-part headers in the plan (Morning, Afternoon, Evening).
- **Serif Italic** (Instrument Serif Italic 22/28): narrative lines only. The empty-state promise, and the place names rolling in like film credits during analysis.
- **Body** (Geist 400 15/22): why-go lines, descriptions. Keep to ~40 characters per line on cards.
- **Label** (Geist 500 13/18): buttons in compact spots, pill text, list meta.
- **Micro-caps** (Geist 600 11, tracking 2, uppercase, Ash): areas, states, section eyebrows. `OM BEACH · GOKARNA`.
- Numbers in counters and times use tabular figures so they don't jitter while counting.

### Named rules
**The Two-Voices Rule.** Serif says *where*. Sans says *what to do*. A button is never serif; a place name is never Geist.

## Layout

- Single-column phone layouts, 24pt side gutter, 8pt rhythm.
- Content respects safe areas; photography does not. Hero images bleed under the status bar and home indicator.
- Primary actions sit in the bottom third, within thumb reach. The top of the screen is for reading.
- Bottom action bars sit on a Night-to-transparent gradient so content can scroll under them without a hard edge.
- Minimum touch target 44×44pt. Small visuals get `hitSlop`, not bigger visuals.

## Elevation & depth

Depth comes from **photography dissolving into Night**, **glass**, and **stacking**, not from drop shadows.

### The gradient-only-under-text rule
A photo stays untouched until ~40pt above the first line of text on it. From there it falls off fast to solid Night at the bottom edge:

| Card type | Clean until | 50% at | Solid Night at |
|---|---|---|---|
| City / hero photo card | 64% | 73% | 100% |
| Pick card (taller text block) | 40% | 52% (60%) | 100% (92% at 70%) |

Because the gradient ends in exactly Night, the card melts into the screen instead of floating on it.

### The glass rim
Photo cards carry a thin lit edge, like the photo is behind a glass pane: a 1pt border, bright at the top-left (light from 315°), fading to nothing at the bottom-right. In Figma this is the Glass effect (radius 2). In code it's a gradient border, identical on iOS and Android.

### Glass pills
- **Over photos:** Glass Dark (Night 38%) + rim. White glass disappears on bright skies.
- **Over dark UI:** Glass Light (white 14%) + rim.
- Background blur (`expo-blur`, intensity ~20) sits under both. Blur intensity is never animated; fade a static blur's opacity instead.

### Shadows
Used exactly once: the Ember glow under the primary Keep button (Ember 45%, y 8, radius 24). It says "this is the button". Nothing else gets a shadow.

## Shapes

- **Photo cards:** 28pt radius.
- **Sheets:** 32pt top radius.
- **Buttons, pills, chips:** fully round.
- **Thumbnails in lists:** 14pt radius.
- **Map pins:** perfect circles.
- No hard corners anywhere; no borders heavier than 1pt except the pin ring (2.5pt Ember).

## Map

Raahi's map is a **custom-drawn, stylised dark map**, not Apple or Google Maps.

- Night sea, Basalt land, faint hairline roads, a serif "Arabian Sea" label. Only the places the user collected appear on it.
- **Why custom:** the pin drop is our hero moment. Animated custom markers on native map SDKs are notoriously janky (they're rasterised snapshots), while pins drawn by us run on the UI thread at full frame rate. It also looks identical on iOS and Android, and works in Expo Go with no API keys.
- **Cost:** it's not a real street map. For the POC that's right; real navigation hands off to Google/Apple Maps ("Open in Maps").

**Pins** are 44pt photo bubbles with a 2.5pt Ember ring. The selected pin grows to 56pt. In a plan, pins become numbered (1, 2, 3…) in the order of the day.

## Components

### Buttons
- **Primary** (Ember, Night label, Geist 600 16, 56pt, pill): one per screen. Keep, Find places, Plan my day.
- **Secondary** (Glass Light + rim, Mist label): Skip, Cancel.
- **Text action** (Ash, Geist 500 14, trailing →): "Keep the rest →", "Try a sample link".
- Press: scale 0.97 in 120ms, ease-out, on press-in (see Motion).

### Photo card
Image + gradient-only-under-text + glass rim + Display XL name + micro-caps. Used for city cards, the Pick card and place detail.

### Pick card (signature component)
The system's defining object: a full-bleed photo card, 28pt radius.
- Dark-glass type pill at the top (`Sight · Om Beach, Gokarna`)
- Place name in Display XL
- Why-go line in Body, Mist 88%
- Meta pills (Glass Light): best time · cost · time needed
- Source line in Ash: `From @konkan.trails · 1:42 in the reel`

It sits on a fanned stack: two cards behind, rotated −7° (Olive) and +9° (Stone 45%, blurred).

### Itinerary stop
Numbered Ember dot + 56pt rounded thumbnail + name (Geist 500) + meta (Ash). Between stops, a connector line with the walk time: `12 min walk · 0.9 km`.

### Gap-fill suggestion
A dashed-rim Basalt card in the empty slot: *"Nothing planned for dinner."* + a local pick labelled `RECOMMENDED BY LOCALS` + an Add button. Clearly a suggestion, never silently added.

## Motion

### The Two-Speeds Rule
Raahi moves at two speeds, and never mixes them up:

1. **UI speed (≤300ms).** Anything the user does often: press, toggle, sheet, card commit. Fast, ease-out, never in the way.
2. **Cinematic speed (400–600ms+).** Only the rare, story moments that happen once per link: the analysis, the reveal, the route drawing itself. This is where Direction A's "nothing snaps; everything settles" lives.

A tap is never cinematic. A reveal is never rushed.

### Tokens
| Token | Value | Use |
|---|---|---|
| `ease-out` | `bezier(0.23, 1, 0.32, 1)` | Entrances, exits, press, default |
| `ease-in-out` | `bezier(0.77, 0, 0.175, 1)` | Things moving across the screen: camera pans, indicators |
| `ease-sheet` | `bezier(0.32, 0.72, 0, 1)` | Custom sheets (native sheets use the platform) |
| `press` | 120ms | Press scale |
| `small` | 180ms | Toggles, chips, counters |
| `ui` / `ui-max` | 260 / 300ms | Entrances, card commits |
| `cinematic` | 450ms | Camera moves, reveal fades |
| `spring-settle` | 400ms, damping 1 | Settles with no overshoot |
| `spring-drag` | 400ms, damping 0.8 + finger velocity | Snap back after a drag |
| `spring-sheet` | 300ms, damping 0.8 | Sheets |
| `spring-land` | 500ms, damping 0.72 | Pin drop only (rare delight tier) |

**Never `ease-in` on UI.** Never scale from 0; start at 0.9–0.97 with opacity 0. Only `transform` and `opacity` animate.

### Principles
- **UI thread only.** Reanimated 4 shared values and worklets; no `setState` per frame, no core `Animated`.
- **Springs when a finger is involved.** Release velocity is handed to the spring, so there's no seam between finger and animation.
- **Interruptible.** Any drag can be grabbed mid-flight and continues from where the eye last saw it.
- **Native navigation.** Screen pushes, modals and sheets use Expo Router's native stack. Never rebuilt in JS.
- **Tabs and filters never slide.**

### Microinteractions, beat by beat

**0 · Empty home** *(rare, first-run; purpose: delight + explanation)*
- Hero dusk photo drifts (Ken Burns): scale 1.0 to 1.08 over 20s, linear, alternating. Off under reduced motion.
- Three ghosted pins pulse faintly (opacity 0.25 to 0.6, 2.4s, staggered 800ms). They promise the payoff before it exists.
- Headline and button fade up on mount: opacity 0 and y +12 to rest, 300ms ease-out, 60ms stagger.
- **Clipboard nudge:** when the app comes into focus and the clipboard holds a URL, a dark-glass chip slides up (`Link on your clipboard · Add it?`), 260ms ease-out. It's checked with `hasUrlAsync`, so no iOS paste prompt fires until the user taps.

**1 · Paste** *(occasional; purpose: feedback)*
- Native form sheet (`presentation: 'formSheet'`) with the platform's own animation.
- Field focus: the rim brightens from white 16% to white 32%, 180ms.
- Source icons (Instagram, YouTube) light up to Mist when the pasted URL matches; the others dim to 30%. 180ms. This confirms "we can read this" before submitting.
- **Invalid link:** field shakes horizontally (translateX 0, −8, 8, −5, 5, 0 over 300ms) + error haptic + helper text in Ash. No red.
- Submit: press scale, sheet dismisses, analysis begins.

**2 · Analysing** *(rare, the product's hero; purpose: explanation + delight)*
- Reel preview card enters: scale 0.96 to 1, opacity 0 to 1, 300ms ease-out.
- A light sweep crosses the thumbnail (a diagonal gradient band translating across it, 1.4s, linear, looping) while the status reads *Reading the description…*
- **Places roll in like film credits:** each name appears in Serif Italic, opacity 0 and y +8 to rest, 300ms ease-out, **130ms apart**. That's slower than a normal list stagger on purpose, because each name is content to read. A tabular counter ticks up with it: `Found 4 places`.
- Status line crossfades (180ms) through *Reading the description…*, *Finding places…*, *Placing them on the map…*
- One success haptic when the last place lands. **No per-place haptic ticks:** a haptic belongs to something the user did, and a burst of seven would train people to turn haptics off.
- Hands off to the map with a native fade.

**3 · Reveal** *(rare; purpose: spatial consistency + delight)*
- Map fades in and the camera settles from 1.12× to 1.0×, 600ms ease-out.
- **Pins drop in, 80ms apart:** y −24 to 0, scale 0.9 to 1, opacity 0 to 1, `spring-land` (500ms, damping 0.72). This is the only overshoot in the app that isn't finger-driven, and it's allowed because the moment happens once per link.
- A light impact haptic fires as the **last** pin lands.
- The bottom panel rises 300ms after the last pin: `spring-sheet`.
- Tap a pin: it grows 44 to 56pt (`spring-settle`), the camera pans to it (450ms ease-in-out), and a native sheet opens with that place's card.

**4 · Pick** *(tens of times per trip; purpose: feedback + spatial consistency)*
- The card follows the finger 1:1. Rotation is tied to horizontal drag: ±12° at ±width. Horizontal axis locked (`activeOffsetX ±10`) so vertical scroll never fights it.
- A **Keep** label (Ember) and **Skip** label (Mist) fade in on the side you're dragging toward, reaching full opacity at 35% of card width.
- **Commit** if the projected position (position + momentum) passes 40% of the screen width, so a quick flick is enough. The card flies off with the finger's velocity (250ms ease-out) and a light haptic fires on commit.
- Release before the threshold and it springs home (`spring-drag`, velocity handed over).
- The next card promotes from the stack: scale 0.95 to 1, y 12 to 0, rotation to 0, `spring-settle`. The back cards re-fan behind it.
- The Skip / Keep buttons run the same fly-off programmatically.
- **Undo** brings the last card back from the side it left, `spring-settle` + selection haptic.
- The counter (`3 of 7 · 6 kept`) updates with a 180ms crossfade.
- "Keep the rest →" skips the remaining cards (all kept by default) and goes straight to the plan.

**5 · Plan** *(occasional; purpose: explanation + spatial consistency)*
- **The route draws itself:** the Ember line draws from stop 1 to the last stop, 900ms ease-in-out, starting after the numbered pins pop in (80ms apart, 260ms ease-out). Under reduced motion it fades in instead.
- The itinerary panel rises from the bottom with `spring-sheet`.
- **Scroll-synced camera:** as the list scrolls, the stop crossing the reading line becomes active. Its pin grows, its row brightens from Stone to Mist, and the map camera pans to it (450ms ease-in-out). Runs entirely on the UI thread (`useAnimatedReaction` on scroll position). No haptics on scroll.
- **Gap-fill Add:** the suggestion card collapses into a stop (layout transition 260ms), the route redraws to include it, and a light haptic fires.
- **Save trip:** success haptic, then back to home, where the new city card is waiting.

**Home (returning)** *(tens of times; purpose: feedback only)*
- City cards are already there on return. No entrance animation for content the user sees every day.
- Only the newly added city fades up once (300ms ease-out) the first time it appears.
- Cards: press scale 0.97, native push into the city map.

### Haptics
| Moment | Haptic |
|---|---|
| Analysis finishes (last place found) | `notificationAsync(Success)` |
| Last pin lands on reveal | `impactAsync(Light)` |
| Pick: card committed (keep or skip) | `impactAsync(Light)` |
| Pick: undo | `selectionAsync()` |
| Invalid link | `notificationAsync(Error)` |
| Gap-fill added to plan | `impactAsync(Light)` |
| Trip saved | `notificationAsync(Success)` |

Rules: same frame as the visual, one per user action, never on scroll, never the only feedback.

### Reduced motion
Fewer and gentler, not zero:
- Ken Burns and pin pulses off
- Pins fade in instead of dropping
- Route fades in instead of drawing
- Camera jumps with a 200ms crossfade instead of panning
- Card swipes still follow the finger (the user is driving), but fly-off shortens to 150ms with no rotation
- Screen transitions become `fade`

## Do's and don'ts

### Do
- **Do** let photos dissolve into Night with the gradient-only-under-text rule.
- **Do** use dark glass on photos and light glass on dark.
- **Do** keep Ember for acting and "yours". One accent, always.
- **Do** keep the two speeds apart: UI ≤300ms, cinematic only for once-per-link moments.
- **Do** make every drag interruptible and hand the finger's velocity to the spring.
- **Do** judge motion feel on a real phone, never only in a preview.

### Don't
- **Don't** add warm UI colours (Sand is retired). Warmth comes from photography.
- **Don't** put white glass on a bright photo; it disappears.
- **Don't** animate `height`, `width`, `margin` or blur intensity. Transform and opacity only.
- **Don't** fire haptics on scroll, per frame, or for things the user didn't cause.
- **Don't** make tabs, filters or counters slide.
- **Don't** set place names in Geist or buttons in the serif.
- **Don't** show a place without a photo, a why-go line and its source. "Places arrive blank" is the #1 complaint about our competitors.
