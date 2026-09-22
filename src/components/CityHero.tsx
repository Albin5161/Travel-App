import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { PanelTabs, restPeek } from '@/components/plan/PanelTabs';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
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

const CIRCLE = 92;

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
// state, serif city name, a count line and a round glass "Start planning" button.
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

        <View style={[styles.center, { top: height * 0.3 }]}>
          <Text variant="micro" color={light.photoInkSoft}>
            {city.state}
          </Text>
          <Text style={styles.name}>{city.name}</Text>
          <Text style={styles.line}>
            <Text style={[styles.line, styles.accent]}>
              {stats.places} {stats.places === 1 ? 'place' : 'places'}
            </Text>{' '}
            from {stats.reels} {stats.reels === 1 ? 'reel' : 'reels'}
          </Text>

          <PressableScale
            onPress={onStart ?? noop}
            style={styles.circle}
            accessibilityRole="button"
            accessibilityLabel={stats.planned ? 'See your day' : 'Start planning'}
          >
            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
            <Text variant="label" color={light.photoInk} style={styles.circleText}>
              {stats.planned ? 'See your\nday' : 'Start\nplanning'}
            </Text>
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
  center: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 6 },
  name: {
    fontFamily: fonts.serif,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -0.4,
    color: light.photoInk,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 12,
  },
  line: {
    fontFamily: fonts.serifItalic,
    fontSize: 22,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 10,
  },
  accent: { color: '#F2B48A' },
  circle: {
    marginTop: 28,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.28)',
    borderWidth: 1,
    borderColor: light.photoLine,
  },
  circleText: { textAlign: 'center', lineHeight: 17 },
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
