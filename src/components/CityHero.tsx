import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { PanelTabs, restPeek } from '@/components/plan/PanelTabs';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { cityPlaceLine } from '@/data/api';
import type { City } from '@/data/types';
import { Tone } from '@/theme/tone';
import { fonts, light } from '@/theme/tokens';

export type HeroStats = { places: number; reels: number; planned: boolean };

type Props = {
  city: City;
  stats: HeroStats;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  onBack?: () => void;
  onStart?: () => void;
  /** The city page draws its own fixed back button, above the scrolling panel. */
  hideBack?: boolean;
  /** Draw the Plan panel's resting edge. The growing card does; the city page has the real panel. */
  peek?: boolean;
};

// Scrims over the full-bleed city photo: a little at the top for the status bar and back button,
// more at the bottom for the title block. Shared by the city page and the growing card.
export function HeroScrim() {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']}
        locations={[0, 1]}
        style={[StyleSheet.absoluteFill, { bottom: '70%' }]}
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.75)']}
        locations={[0, 0.25, 0.6, 1]}
        style={[StyleSheet.absoluteFill, { top: '22%' }]}
      />
    </>
  );
}

// Everything drawn over the photo on the city page (after Atlys's country page): back button,
// state, serif city name, a count line and the primary action.
//
// The block sits just above the panel's resting edge rather than floating at a third of the height.
// That puts the type where the scrim is strongest (so it stays legible on a bright photo), leaves
// the picture itself uncovered, and stacks name → action → panel in the order they're used.
// Laid out for a full-screen box; the opening card renders it scaled down so the swap is seamless.
export function CityHeroContent({
  city,
  stats,
  width,
  height,
  insetTop,
  insetBottom,
  onBack,
  onStart,
  hideBack,
  peek,
}: Props) {
  const interactive = !!onStart;
  return (
    <Tone value="dark">
      <View style={{ width, height, pointerEvents: interactive ? 'box-none' : 'none' }}>
        {hideBack ? null : (
          <View style={[styles.top, { top: insetTop + 8 }]}>
            <IconButton icon="chevron-left" onPress={onBack ?? noop} accessibilityLabel="Back to your cities" />
          </View>
        )}

        <View style={[styles.block, { bottom: restPeek(insetBottom) + 26 }]}>
          <Text variant="micro" color={light.photoInkSoft}>
            {cityPlaceLine(city)}
          </Text>
          <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {city.name}
          </Text>
          <Text style={styles.line}>
            <Text style={[styles.line, styles.accent]}>
              {stats.places} {stats.places === 1 ? 'place' : 'places'}
            </Text>{' '}
            from {stats.reels} {stats.reels === 1 ? 'reel' : 'reels'}
          </Text>

          {/* White, not black: on a photo the ink button disappears into the scrim. Same weight and
              shape as every other primary, inverted for the surface it sits on. */}
          <PressableScale
            onPress={onStart ?? noop}
            containerStyle={styles.ctaSlot}
            style={styles.cta}
            accessibilityRole="button"
            accessibilityLabel={stats.planned ? 'See your day' : 'Start planning'}
          >
            <Text style={styles.ctaLabel}>{stats.planned ? 'See your day' : 'Start planning'}</Text>
          </PressableScale>
        </View>

        {peek ? (
          <View style={[styles.peek, { top: height - restPeek(insetBottom) }]}>
            <PanelTabs active={0} />
          </View>
        ) : null}
      </View>
    </Tone>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 16 },
  block: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 6 },
  name: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 51,
    letterSpacing: -1.8,
    color: light.photoInk,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 12,
  },
  line: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 10,
  },
  // The count is the news, so it takes Jakarta's weight; the rest of the line stays Geist.
  accent: { fontFamily: fonts.displayBold, color: '#F2B48A' },
  ctaSlot: { alignSelf: 'stretch', marginTop: 22 },
  cta: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.panel,
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  ctaLabel: { fontFamily: fonts.sansSemi, fontSize: 16, letterSpacing: 0.1, color: light.ink },
  peek: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: light.panel,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  dim: { backgroundColor: 'rgba(0,0,0,0.12)', pointerEvents: 'none' },
});
