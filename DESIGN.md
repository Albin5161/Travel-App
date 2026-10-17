---
name: Xplore
description: Turn the travel videos you saved into a trip you'll actually take. One look, Light — a white page with grey-edged panels, one dark ink, one black button and a warm ember accent — on a two-tier colour system.
looks:
  light: "The only look (since 15 Oct 2026). A white page, white panels edged in grey, grey controls, one dark ink and one grey, one black button. Its greys are measured from Airbnb."
  sky: "Switched off, code kept. The time-of-day sky with frosted glass and white type. SKY_AVAILABLE in src/theme/mode.ts brings it back; nothing new is designed or checked for it."
tiers:
  primitives: "src/theme/primitives.ts — raw colours, named for what they are (paper/0, grey/900, ember/600)."
  semantic: "src/theme/semantic.ts — what a colour is for (ink/strong, fill/raised, cta). src/theme/sky.ts hands screens the set under its older names (skyInk, skyFill, skyCta)."
typography:
  hero: { fontFamily: "Plus Jakarta Sans ExtraBold", fontSize: 40, lineHeight: 44, letterSpacing: -1.4, note: "the one exception: a city or place name" }
  display: { fontFamily: "Plus Jakarta Sans ExtraBold", fontSize: 32, lineHeight: 36, letterSpacing: -1 }
  headline: { fontFamily: "Plus Jakarta Sans Bold", fontSize: 20, lineHeight: 24, letterSpacing: -0.45 }
  title: { fontFamily: "Plus Jakarta Sans SemiBold", fontSize: 16, lineHeight: 24, letterSpacing: -0.25 }
  body: { fontFamily: "Geist", fontSize: 14, lineHeight: 20 }
  bodyStrong: { fontFamily: "Geist Medium", fontSize: 14, lineHeight: 20 }
  label: { fontFamily: "Geist Medium", fontSize: 12, lineHeight: 16 }
  tag: { fontFamily: "Geist SemiBold", fontSize: 10, lineHeight: 12, letterSpacing: 0.1 }
rounded: { thumb: 14, pane: 16, glass: 24, card: 28, sheet: 32, pill: 999 }
spacing: { xs: 4, sm: 8, md: 12, lg: 16, screen: 20, xl: 24, xxl: 32 }
---

# Xplore design system

## One look: Light

Every screen is designed and checked in Light only. Keeping two looks made each change three
times the work, so on 15 Oct 2026 the Sky look was switched off rather than deleted:
`SKY_AVAILABLE = false` in `src/theme/mode.ts` puts everyone in Light, whatever they chose before,
and Profile no longer offers a Look switch. The Sky code and its values stay in the app; setting
the flag back to `true` returns both. Don't add Sky values to new work, and don't check screens in it.

| | Light |
|---|---|
| Canvas | White: `paper/0` |
| Panel (`Glass`) | White, `grey/300` hairline rim, no shadow |
| Type | `grey/900`, and one quieter `grey/600` |
| Main button | Black (`ink/900`), white label |
| Accent | `ember/600` large, `ember/700` small |
| Status bar | Dark |

Screens still name colours by their job through the older names in `src/theme/sky.ts`
(`skyInk.strong`, `skyFill.raised`, `skyCta`). The names stayed so no screen had to change; read
"sky" in them as "the app's".

## Tier one: primitives

Raw colours in `src/theme/primitives.ts`. Nothing outside `src/theme/` imports them.

- **paper** 0 `#FFFFFF`, 50 `#F7F6F2`, 100 `#F5F4F1`, 200 `#ECEAE6`, 300 `#E6E3DC`
- **grey** (no tint; measured from Airbnb's screens) 50 `#F7F7F7`, 100 `#F2F2F2`, 200 `#EBEBEB`, 300 `#DDDDDD`, 600 `#6A6A6A`, 900 `#222222`
- **ink** 300 `#A3A3A3`, 500 `#646464`, 600 `#5E5E5E`, 900 `#111111`, 950 `#0E0F12`
- **ember** 200 `#FFD6BE`, 300 `#FFA877`, 500 `#E2763C`, 600 `#D4622B`, 700 `#A34A1C`
- **green** 300 `#4ADE80`, 700 `#126E34` · **red** 300 `#FFB09A`, 700 `#B42318`
- **white(α)**, **black(α)** for fills and lines that let what's behind show through
- **navy** ramps (one per time of day) belong to the switched-off Sky look

## Tier two: semantic colours

Defined in `src/theme/semantic.ts`, handed out by `src/theme/sky.ts`. Light's values:

| Token | For | Light |
|---|---|---|
| `ink.strong` | Titles, values | grey/900 |
| `ink.soft` | Body | grey/600 |
| `ink.faint` | Captions (still passes 4.5:1) | grey/600 |
| `ink.line` / `ink.rim` | Dividers / panel edges | grey/200 / grey/300 |
| `ink.outline` | Empty rings, unticked boxes (3:1) | black 45% |
| `fill.pane` | A row inside a panel | grey/50 |
| `fill.raised` | A control: chip, field, pill | grey/100 |
| `fill.pressed` | Pressed or focused control | grey/200 |
| `fill.well` | A track a control slides in | grey/200 |
| `cta` / `onCta` | Main button and what's on it. Our own black, not Airbnb's `#222222` | ink/900 / white |
| `onInk` | Content on a surface filled with `ink.strong` | white |
| `accent` / `accentText` | Warm note, large / small | ember/600 / 700 |
| `signal.up` / `signal.down` | Good / bad news | green/700 / red/700 |

Paper cards (tickets, the map's art, legal pages) use `light` in `src/theme/tokens.ts`; type over
photographs uses its `photoInk` values.

## Type

Six sizes, all even, every line height on the 4pt grid: **10 · 12 · 14 · 16 · 20 · 32**, plus
40 for the big name on a city or place. Agreed with Albin on 17 Oct 2026; it replaced 14 styles on
9 sizes. The sizes live in `fontSize`, `lineHeight` and `textSize` in `src/theme/tokens.ts`; the
`Text` component's variants are the styles.

| Style | Size / line | Font | For |
|---|---|---|---|
| `display` | 32/36 | Jakarta ExtraBold | Screen titles |
| `headline` | 20/24 | Jakarta Bold | Sections, sheet titles, code digits |
| `title` | 16/24 | Jakarta SemiBold | Card titles; buttons and fields use this size in Geist |
| `body` / `bodyStrong` | 14/20 | Geist Regular / Medium | Reading text |
| `label` | 12/16 | Geist Medium | Meta, chips, small print |
| `tag` | 10/12 | Geist SemiBold | Badges, pin numbers, tab labels, credits |

- Colour and figures are switches, not styles: `ink="soft" | "faint"` for a quieter line,
  `tabular` for counts, dates and prices.
- `tag` is a few words or a number, never a sentence, and always in the darkest ink. Nothing goes
  below 10.
- Fields stay at 16 or more, or iPhone browsers zoom the page into the box.
- Never write a font size in a screen: spread `textSize.x` or use `fontSize.x`. Jakarta needs a
  line height of 1.1x its size or more, or iOS crops the tops of the capitals.
- Allowed off the scale: the logo (`Wordmark`), drawings sized to their own art (map labels,
  passport stamp, intro scenes, avatar initials), the share picture (it scales as one) and the PDF.

## Rules

- WCAG AA: every ink used for words meets 4.5:1 on white and on a panel.
  `node --experimental-strip-types --import ./scripts/ts-paths.mjs scripts/check-sky-contrast.mjs`
  checks the paper (and the six skies, which no longer ship).
- Never fade text to show what isn't in focus: fading a row to 50% took its words under 4.5:1.
  Fade the photo, or mark the current item instead.
- Tap targets are 44pt, including tabs, chips and icon-only buttons.
- One black thing per screen, and it's the main action. A chosen tab is outlined in ink; a toggled
  tool (Edit → Done) is a `fill.pressed` pill with a tick. Ember is the only warm colour.
- Never write a colour value in a screen. If a screen needs a colour that has no semantic name,
  add the name to tier two.
- Anything that sits on a photograph or on the black button uses fixed colours (`onCta`,
  `light.photoInk`), not the canvas inks.
- Errors are red words and a red field border, never a red box.

## Phones

- Android draws no blur for glass (expo-blur needs a target view a sheet's window can't use), so
  glass asked to blur is a near-solid pane there (`Glass`). Nothing may rely on blur to stay legible.
- The share ticket tilts with the phone and catches a moving shine on iPhone and the web; on
  Android it stays flat with no shine, so its text is sharp (`TiltCard`).
- In Light the share screen puts the ticket on a rounded swatch of the state's cloth
  (`PatternBackdrop`), the same cloth the saved Story picture prints.
- Amma and the child appear on every loading wait and extraction error (`MascotMoment`,
  `ReadingScene`, `PlanningScene`).
