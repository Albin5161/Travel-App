---
name: Xplore
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
    fontFamily: "Plus Jakarta Sans"
    fontSize: 44
    fontWeight: 800
    lineHeight: 49
    letterSpacing: -1.6
  display:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 34
    fontWeight: 800
    lineHeight: 38
    letterSpacing: -1.1
  headline:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 22
    fontWeight: 700
    lineHeight: 27
    letterSpacing: -0.5
  title:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 18
    fontWeight: 600
    lineHeight: 24
    letterSpacing: -0.3
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
    letterSpacing: 0.9
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

# Design System: Xplore

## Direction update: Light (22 Sep 2026, in progress)

Xplore (formerly Raahi) has moved from "a travel film at dusk" to a **light, airy direction modelled on the Atlys iOS app**, and every screen is now light. **Where this section and the dusk system below disagree, this section wins.** The dusk rules still describe what sits *on photos* (place cards, the reel preview): those wrap themselves in `<Tone value="dark">` (`src/theme/tone.tsx`) so their text stays light on the image.

**North star:** paper UI, photos carry all the colour. The chrome almost disappears (hairlines, pale fields, small grey labels) so the photo cards read as objects sitting on paper.

**Colours** (`light` in `src/theme/tokens.ts`)
- **Canvas** `#F5F4F1`, washing up to **Canvas top** `#ECEAE6`: the screen background. Never pure white.
- **Panel** `#FFFFFF`: the white panel that rises over the canvas (home grid; later the Plan panel over the city photo). Top corners 32.
- **Ink** `#111111` for titles and key values; **Ink soft** `#5E5E5E` for body; **Ink faint** `#A3A3A3` for placeholders, captions and micro-caps.
- **Lines** `rgba(17,17,17,0.08)`, strong `0.16`: field borders and dividers.
- **Primary button: solid black (`#111111`) with white text.** One per screen at most.
- **On photos:** white text, 72% white for secondary, 22% white hairlines.
- Ember (`#E2763C`) stays available as a small accent, not as the button colour.

**Type:** Plus Jakarta Sans for headings, Geist for everything you read (see Typography, updated 23 Sep 2026). Headlines are **two-weight**: a Medium lead-in in Ink soft, then the payoff in ExtraBold Ink ("Which reel is / **your next trip?**"). City names on photo cards are Jakarta ExtraBold 22/25, title case, -0.7 tracking.

**Home (Collect mode)**
- Wordmark, then a left-aligned two-weight question.
- **Link box:** a white pill field (48 high), with the platform icon swapping in (link → Instagram/YouTube) once the link is recognised, and a **black circular system Paste button** beside it. The box sticks to the top while scrolling.
- A hint line under the box: "You copied a link. Tap paste to add it." when iOS reports a link on the clipboard (checked without reading it), or the error line after a gentle shake.
- **White panel with a 2-column grid of tall city tiles** (ratio 1.55, radius 22, soft shadow): Jakarta ExtraBold name, a hairline, a SPOTS row, and a two-line caption under the card ("Collected from / 2 reels", or "Day planned / Ready to go").
- Empty state: the grid shows Gokarna, Kochi and Meghalaya as **Sample** tiles; tapping one runs its demo reel.

**Map (paper):** pale land `#F7F6F2`, soft blue-grey sea `#DDE6E7`, quiet roads, grey labels. Photo pins have a **white rim and a soft shadow**; numbered badges and the day's **route are ink black**. White panels rest on the map (City, Plan).

**Round icon buttons** (back, close, undo): white, a hairline border and a faint shadow (`IconButton`).

**Save or Plan (end of analysing):** once the places have rolled in, they're already saved. The user chooses what's next: **Save N spots** (black; back to home, stays in Collect) or **Plan this trip →** (text; into the map reveal and Pick). If the city already existed, the button reads "Add N spots to Gokarna". A single-spot reel skips the choice: "Namaste Café added to Gokarna", then back home.

**Card → city page (signature transition):** tapping a city card on home grows a copy of it from the card's exact spot to full screen in **420ms** (`cubic-bezier(0.32, 0.72, 0, 1)`), with a light haptic. The corners open from 22 to ~44 as it grows, then square off where the phone's own corners take over. The card's label fades out in the first 30%, and the city page's content (scaled with the card, never reflowing) fades in from 35–85%. Then the city page appears underneath with no animation of its own. Going back plays it in reverse as a **spring (450ms, damping 0.8)** that settles into the card, however the user got home. Reduced motion: a 200ms crossfade. Code: `CityOpenOverlay`, `CityHero`.

**City page (Plan mode):** full-bleed city photo, a white back button, the state in micro caps, the city name in Jakarta ExtraBold 46/51 at -1.8 tracking, "7 places from 1 reel" in Geist Medium 16 (the count in Jakarta Bold, warm peach), and a round dark-glass **Start planning** button (**See your day** once planned).

**The Plan panel** (after Atlys's visa page): a white panel rests at the bottom showing only its grabber and tabs, **Overview · Places · Plan · Good to know**. Scrolling (or tapping a tab) slides it up over the photo, snapping to "resting" or "up". When it's up, a strip of photo stays visible at the top, holding the back button. As the panel rises, the title drifts up more slowly, fades and shrinks slightly, and the photo dims.
- **Tabs** stick under the photo strip. The black underline **slides** (spring) to the active tab, and scroll-spy keeps it in sync as you scroll.
- **Overview:** summary, three quick facts (best time, ideal stay, per day), and **cost per day** as horizontal ink bars (stay, food, getting around, entry), marked as our estimate.
- **Places:** "Open the map", then each place with a photo, type and area, **★ rating · review count**, one short review, and its author. Marked "Ratings and reviews from Google. Sample data for the demo."
- **Plan:** the day in three rows (Morning / Afternoon / Evening) with start times, stop counts and stacked photo thumbnails.
- **Good to know:** first **Safety today**, after Atlys's "India currently": "Gokarna currently" with the **score (0–100, green) sitting above the end of a gradient bar** (peach → olive → green) that fills over 0.9s the first time the tab is reached, with the bands **Low · Moderate · High · Excellent** underneath (reached bands in ink, the rest faint). Below it, **dated signals** explain the score: month and year on a rail, and a card with one line and a green ▲ or red ▼ tag. It's always labelled "Based on traveller reports and local news" and marked as sample data until a real source backs it. Then the **specific facts** (an icon, a title and one line each) and the tips "From locals".
- A **sticky bottom bar** takes over from the round button once the panel is mostly up: "7 places from 1 reel · ₹1,800 – ₹3,000 a day" with a black **Start planning**.
- Back while the panel is up lowers it first, so the page shrinks into its card from the resting layout.

The map is its own screen (`map/[id]`), reached from Places ("Open the map") or from "Plan this trip →" after analysing.

**Signature animations** (Albin's designs in `references/animations/`, rebuilt natively in `src/components/motion/`):
- **Opening** (`LaunchIntro`, once per launch, skipped with Reduce Motion): a winding accent route draws itself in 0.6s with a light at its tip, and a pin drops onto its end at 0.35s with a bounce, a ripple and a light haptic. At 0.55s the pin shrinks into a **dot inside the o** while "Xplore" fades up letter by letter (0.05s stagger), so the o reads as a location marker. The route fades and "EVERY PATH HAS A STORY" appears by 1.6s, then the layer fades to reveal home. The letters are placed from Plus Jakarta Sans ExtraBold's own advances at 40, less -0.04 em tracking, so the dot (0.2 em, inside a 0.275 em counter) sits centred in the o's hole.
- **Reel scanner** (`ReelScanner`, Analysing): a white orb on the reel card's bottom-right edge. Three ink ripples, an accent arc circling (2.4s cycle), and the orb's icon cycling play → pin → sparkle. When all places are found, the arc closes into a ring, a check draws in, and the orb pops once (0.6s).
- **Saved tick** (`SavedTick`, after "Save N spots" and on single-spot quick-save): an ink circle pops in with overshoot, a white check draws itself, and six accent dots burst and fade (0.7s). Then back home.
- **Passport stamp** (`PassportStamp`, "Save this day"): the page veils to paper, and an Ember stamp (worn double ring, curved "XPLORE · DAY PLANNED", the city in Jakarta ExtraBold capitals sized to fit between the stars, the date) drops from 1.6× at -12° to land at -6° in 0.35s with a **haptic thud**, squashes to 0.96, rebounds and settles as an ink ring spreads. It holds, then goes home. Tap to skip.
- **Share card** (`TiltCard` + `PlanPass`, after the stamp): "Your Xplore plan is ready" over the plan as a boarding pass (photo above a perforated tear; start and wrap-up, or the dates for a longer trip, the stops, issue date and barcode below). The card is dealt in (rises 70pt, scale 0.92→1, rotateX 22°→0 on a 900ms spring with damping 0.62) and one band of holographic light sweeps across it. It then leans with the phone, exaggerated: the gravity vector, measured against a neutral that drifts to your grip over ≈2s, up to 11° each way. A foil band and a glare slide the other way as if the light were fixed in the room, the photo shifts 9pt for parallax, and the shadow moves underneath. A finger tilts it too; without a sensor (web, simulator) it sways until touched. Reduce Motion: no deal, no tilt, static foil. "Share to group" sends the card as an image (with the message on iOS).
- **Group vote** (`/group/[id]`, from "See who's voting" after sharing, or cold from the shared link): three friends (scripted from the plan) join a beat apart. Avatars pop from 0.4 past 1.12 in 420ms, with a "Riya joined" pill. Votes then land one at a time, 380ms apart: an avatar+emoji chip pops in, the stop's three-slot bar fills from the left (ink keep, accent swap, faint drop), and the latest comment shows as a bubble (once decided, the winning side's reason). Two of a kind decides a stop. An overruled stop flips top-over-bottom like a departure board (rotateX 180° in 560ms, light haptic) to the place swapped in, like for like. When every stop is decided: "Everyone's in", a success haptic and a burst of 28 paper confetti from the headline (rare tier; skipped with Reduce Motion). **Lock it in** applies the swaps and drops to the saved plan. **Vote as a friend** (form sheet) is pass-the-phone: pick who you are, then go stop by stop (react, a quick note, Keep / Swap for X / Drop); those votes replace that friend's scripted ones.
- **Safety icons** (`SafetyIcon`, Good to know): 24×24 line icons, 1.5 stroke, one colour. Facts without a matching icon keep a Feather icon.
- *Not carried over from the web versions:* the rough-ink turbulence filter and blur glows (react-native-svg doesn't support them). Worn, dashed rings and a wide low-opacity stroke stand in for them.

**Still to come in this direction:** drag-down to close the city page, and the city card's count ticking up on quick-save.

## Overview

**Creative North Star: "A travel film at dusk."**

Xplore should feel like the opening minutes of a travel film shot at golden hour. The photograph does the talking. The interface steps back into dark glass and gets out of the way. The mood is calm, warm and premium, and it's the opposite of the busy, list-heavy trip planners Xplore competes with. Depth comes from light, photography and glass, never from decoration.

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

**Display:** Plus Jakarta Sans (500, 500 Italic, 600, 700, 800)
**Interface:** Geist (400, 500, 600)

*Updated 23 Sep 2026: Instrument Serif retired. Instrument Serif with Geist had become the default pairing of generated design, and the app read as generated before anyone read a word.*

**Character:** headings are heavy and tightly tracked, so large type reads as one shape. Weight carries emphasis; italics don't (the one exception is water on the maps, where italic is a cartographic convention). Geist stays neutral and untracked for everything you read and operate.

**Tracking scales with size and weight.** Bigger and heavier sets tighter: -0.017 em at Title, up to -0.036 em at Display XL. Medium lead-ins sit looser (about -0.016 em) than the ExtraBold payoffs next to them, or their word spaces close up.

**Line height is never left to default.** Jakarta's ascent plus descent is 1.26 em, so every heading sets a line height of at least 1.1× its size. A Text without one inherits body's 22 and iOS crops the tops of the capitals.

### Hierarchy
- **Display XL** (Jakarta 800 44/49, -1.6): place names on the Pick card.
- **Display** (Jakarta 800 34/38, -1.1): screen titles, e.g. "Gokarna".
- **Headline** (Jakarta 700 22/27, -0.5): section and day-part headers (Morning, Afternoon, Evening).
- **Title** (Jakarta 600 18/24, -0.3): list names that are content, e.g. the places rolling in like film credits during analysis.
- **Body** (Geist 400 15/22): why-go lines, descriptions. Keep to ~40 characters per line on cards.
- **Label** (Geist 500 13/18): buttons in compact spots, pill text, list meta.
- **Micro-caps** (Geist 600 11, tracking 0.9, uppercase, Ash): areas, states, section eyebrows. `OM BEACH · GOKARNA`.
- Numbers in counters and times use tabular figures so they don't jitter while counting.

### Named rules
**The Two-Voices Rule.** Jakarta says *where* and *what matters*. Geist says *what to do* and everything you read. A button is never Jakarta; a heading is never Geist.

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

Xplore's map is a **custom-drawn, stylised dark map**, not Apple or Google Maps.

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
Xplore moves at two speeds, and never mixes them up:

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
- **Places roll in like film credits:** each name appears in Title (Jakarta 600), opacity 0 and y +8 to rest, 300ms ease-out, **130ms apart**. That's slower than a normal list stagger on purpose, because each name is content to read. A tabular counter ticks up with it: `Found 4 places`.
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
- **Don't** set headings in Geist or buttons in Jakarta.
- **Don't** show a place without a photo, a why-go line and its source. "Places arrive blank" is the #1 complaint about our competitors.
