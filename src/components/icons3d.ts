import type { Story } from '@/components/Icon3D';

// The app's 3D icons (made in Figma, 30 Oct 2026; full-size pictures in docs/mockups/3d/icons), each
// with the little story it plays when tapped. `at` is measured on the picture itself.
export const ICONS_3D = {
  /** Near Home: the house puffs smoke from its chimney. */
  near: { source: require('@/assets/images/icons3d/near.png'), story: { kind: 'smoke', at: { x: 0.66, y: 0.14 } } },
  /** Cities: the windows catch the light. */
  cities: { source: require('@/assets/images/icons3d/cities.png'), story: { kind: 'sparkle', at: { x: 0.48, y: 0.42 } } },
  /** Spots: the pin lands, and a ring spreads round its foot. */
  spots: { source: require('@/assets/images/icons3d/spots.png'), story: { kind: 'ring', at: { x: 0.5, y: 0.84 } } },
  /** Trips: the luggage tag glints. */
  trips: { source: require('@/assets/images/icons3d/trips.png'), story: { kind: 'sparkle', at: { x: 0.7, y: 0.34 } } },
  /** Been: the stamp comes down, and a ring spreads from it. */
  been: { source: require('@/assets/images/icons3d/been.png'), story: { kind: 'ring', at: { x: 0.6, y: 0.64 } } },
} satisfies Record<string, { source: number; story: Story }>;
