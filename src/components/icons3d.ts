import type { Story } from '@/components/Icon3D';

// The app's 3D icons (made in Figma, 30 Oct 2026; near and away remade 30 Oct; full-size pictures in docs/mockups/3d/icons), each
// with the little story it plays when tapped. `at` is measured on the picture itself.
export const ICONS_3D = {
  /** Near Home: a house with a pin beside it; the house puffs smoke from its chimney. */
  near: { source: require('@/assets/images/icons3d/near.png'), story: { kind: 'smoke', at: { x: 0.34, y: 0.13 } } },
  /** Away from home: a train; its headlight catches the light. */
  away: { source: require('@/assets/images/icons3d/away.png'), story: { kind: 'sparkle', at: { x: 0.21, y: 0.44 } } },
  /** Spots: the pin lands, and a ring spreads round its foot. */
  spots: { source: require('@/assets/images/icons3d/spots.png'), story: { kind: 'ring', at: { x: 0.5, y: 0.84 } } },
  /** Trips: the luggage tag glints. */
  trips: { source: require('@/assets/images/icons3d/trips.png'), story: { kind: 'sparkle', at: { x: 0.7, y: 0.34 } } },
  /** Been: the stamp comes down, and a ring spreads from it. */
  been: { source: require('@/assets/images/icons3d/been.png'), story: { kind: 'ring', at: { x: 0.6, y: 0.64 } } },
  // The city page's tabs (31 Oct 2026; full size in docs/mockups/3d-tab-icons). Places uses `spots`.
  /** Overview: an open guidebook; the doodled page glints. */
  guide: { source: require('@/assets/images/icons3d/overview.png'), story: { kind: 'sparkle', at: { x: 0.7, y: 0.36 } } },
  /** Plan: a desk calendar; a ring spreads from the circled day. */
  calendar: { source: require('@/assets/images/icons3d/plan.png'), story: { kind: 'ring', at: { x: 0.55, y: 0.56 } } },
  /** Good to know: a shield with a tick; its star glints. */
  shield: { source: require('@/assets/images/icons3d/safety.png'), story: { kind: 'sparkle', at: { x: 0.53, y: 0.14 } } },
} satisfies Record<string, { source: number; story: Story }>;
