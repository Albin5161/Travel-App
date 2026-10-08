---
name: Xplore
description: Turn the travel videos you saved into a trip you'll actually take. Two looks over one set of screens — the sky at this hour with glass on it, or white paper with ink — built on a two-tier colour system.
looks:
  sky: "Default. The sky as it is right now (six times of day), frosted glass panels, white type, one black button."
  light: "A white page, white panels edged in grey, grey controls, one dark ink and one grey, the same black button. Its greys are measured from Airbnb."
tiers:
  primitives: "src/theme/primitives.ts — raw colours, named for what they are (paper/100, ink/900, ember/300, navy/day)."
  semantic: "src/theme/semantic.ts — what a colour is for (ink/strong, fill/raised, cta), one value per look. src/theme/sky.ts hands screens the set for the look that's on."
typography:
  display: { fontFamily: "Plus Jakarta Sans ExtraBold", fontSize: 34, lineHeight: 38, letterSpacing: -1.1 }
  headline: { fontFamily: "Plus Jakarta Sans Bold", fontSize: 22, lineHeight: 27, letterSpacing: -0.5 }
  title: { fontFamily: "Plus Jakarta Sans SemiBold", fontSize: 18, lineHeight: 24, letterSpacing: -0.3 }
  body: { fontFamily: "Geist", fontSize: 15, lineHeight: 22 }
  label: { fontFamily: "Geist Medium", fontSize: 13, lineHeight: 18 }
  micro: { fontFamily: "Geist Medium", fontSize: 12, lineHeight: 16 }
rounded: { thumb: 14, pane: 16, glass: 24, card: 28, sheet: 32, pill: 999 }
spacing: { xs: 4, sm: 8, md: 12, lg: 16, screen: 20, xl: 24, xxl: 32 }
---

# Xplore design system

## Two looks, one set of screens

Every screen is written once. It names colours by their job (`skyInk.strong`, `skyFill.raised`,
`skyCta`), never by their value, and the look that's on decides what each of those is. The look is
chosen in Profile → Look and read once as the app starts (`src/theme/mode.ts`); changing it starts
the app again.

| | Sky (default) | Light |
|---|---|---|
| Canvas | The sky at this hour: a three-stop gradient, a glow, clouds, stars at night | White: `paper/0` |
| Panel (`Glass`) | The sky's own colour, darker, at 34% | White, `grey/300` hairline rim, no shadow |
| Type | White at 100 / 90 / 80% | `grey/900` and one quieter `grey/600` |
| Main button | Black, white label | Black, white label |
| Accent | `ember/300` large, `ember/200` small | `ember/600` large, `ember/700` small |
| Status bar | Light | Dark |

## Tier one: primitives

Raw colours in `src/theme/primitives.ts`. Nothing outside `src/theme/` imports them.

- **paper** 0 `#FFFFFF`, 50 `#F7F6F2`, 100 `#F5F4F1`, 200 `#ECEAE6`, 300 `#E6E3DC`
- **grey** (no tint; measured from Airbnb's screens) 50 `#F7F7F7`, 100 `#F2F2F2`, 200 `#EBEBEB`, 300 `#DDDDDD`, 600 `#6A6A6A`, 900 `#222222`
- **ink** 300 `#A3A3A3`, 500 `#646464`, 600 `#5E5E5E`, 900 `#111111`, 950 `#0E0F12`
- **ember** 200 `#FFD6BE`, 300 `#FFA877`, 500 `#E2763C`, 600 `#D4622B`, 700 `#A34A1C`
- **green** 300 `#4ADE80`, 700 `#126E34` · **red** 300 `#FFB09A`, 700 `#B42318`
- **navy** one top / middle / bottom ramp per time of day: night, dawn, sunrise, day, sunset, dusk
- **white(α)**, **black(α)** for fills and lines that let what's behind show through

## Tier two: semantic colours

Defined per look in `src/theme/semantic.ts`, handed out by `src/theme/sky.ts`.

| Token | For | Sky | Light |
|---|---|---|---|
| `ink.strong` | Titles, values | white | grey/900 |
| `ink.soft` | Body | white 90% | grey/600 |
| `ink.faint` | Captions (still passes 4.5:1) | white 80% | grey/600 |
| `ink.line` / `ink.rim` | Dividers / panel edges | white 18% / 22% | grey/200 / grey/300 |
| `ink.outline` | Empty rings, unticked boxes (3:1) | white 60% | black 45% |
| `fill.pane` | A row inside a panel | white 10% | grey/50 |
| `fill.raised` | A control: chip, field, pill | white 16% | grey/100 |
| `fill.pressed` | Pressed or focused control | white 22% | grey/200 |
| `fill.well` | A track a control slides in | black 14% | grey/200 |
| `cta` / `onCta` | Main button and what's on it. Our own black in both looks, not Airbnb's | ink/950 / white | ink/900 / white |
| `onInk` | Content on a surface filled with `ink.strong` (a chosen chip) | ink/950 | white |
| `accent` / `accentText` | Warm note, large / small | ember/300 / 200 | ember/600 / 700 |
| `signal.up` / `signal.down` | Good / bad news | green/300 / red/300 | green/700 / red/700 |

Paper cards that look the same in both looks (tickets, the map's art, legal pages) use `light` in
`src/theme/tokens.ts`; type over photographs uses its `photoInk` values.

## Rules

- WCAG AA: every ink used for words meets 4.5:1 on its canvas and on a panel, in both looks.
  `node --experimental-strip-types --import ./scripts/ts-paths.mjs scripts/check-sky-contrast.mjs`
  checks all six skies and the paper.
- Tap targets are 44pt.
- One black button per screen is the main action. Ember is the only warm colour.
- Never write a colour value in a screen. If a screen needs a colour that has no semantic name,
  add the name to tier two, with a value for each look.
- Anything that sits on a photograph or on the black button uses fixed colours (`onCta`,
  `light.photoInk`), not the canvas inks: those turn dark in the light look.
