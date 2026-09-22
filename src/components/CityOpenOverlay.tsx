import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { CityHeroContent, HeroScrim, type HeroStats } from '@/components/CityHero';
import { CityTileFace, TILE_RADIUS, type Rect } from '@/components/CityTile';
import { GRADIENTS } from '@/components/PhotoCard';
import type { City } from '@/data/types';
import { haptic } from '@/lib/haptics';

export type OpenCard = {
  city: City;
  /** Where the tile's photo sits on screen. */
  rect: Rect;
  face: { name: string; statLabel: string; statValue: string };
  stats: HeroStats;
};

// Opening follows Atlys: ~0.4s, fast start, long soft landing. Closing lands with a small spring
// overshoot as the card settles back into the grid.
const OPEN = { duration: 420, easing: Easing.bezier(0.32, 0.72, 0, 1) };
const CLOSE = { duration: 450, dampingRatio: 0.8 };
const FADE = { duration: 200, easing: Easing.out(Easing.quad) };

/**
 * The home card grows into the city page and shrinks back into its card.
 * `open` grows a copy of the card to full screen, then pushes the city page (which appears with no
 * animation of its own, drawn identically). `close`, called when home is focused again, plays it
 * in reverse from full screen back to the card, whichever way the user came back.
 */
export function useCityOpen() {
  const [card, setCard] = useState<OpenCard | null>(null);
  // Mirrors `card` so `close` can stay stable (it's called from a focus effect).
  const cardRef = useRef<OpenCard | null>(null);
  const progress = useSharedValue(0);
  const from = useSharedValue<Rect>({ x: 0, y: 0, width: 1, height: 1 });
  const reduced = useReducedMotion();

  const open = (next: OpenCard) => {
    haptic.light();
    cardRef.current = next;
    setCard(next);
    from.set(next.rect);
    progress.set(0);
    setStatusBarStyle('light');
    const push = () => router.push({ pathname: '/city/[id]', params: { id: next.city.id } });
    progress.set(
      withTiming(1, reduced ? FADE : OPEN, (finished) => {
        if (finished) scheduleOnRN(push);
      }),
    );
  };

  const close = useCallback(() => {
    if (!cardRef.current) return;
    setStatusBarStyle('light');
    const done = () => {
      cardRef.current = null;
      setCard(null);
      setStatusBarStyle('dark');
    };
    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(done);
    };
    progress.set(reduced ? withTiming(0, FADE, finish) : withSpring(0, CLOSE, finish));
  }, [progress, reduced]);

  return { card, progress, from, reduced, open, close };
}

type Props = {
  card: OpenCard | null;
  progress: SharedValue<number>;
  from: SharedValue<Rect>;
  reduced: boolean;
};

export function CityOpenOverlay({ card, progress, from, reduced }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The frame moves from the card's rect to the full screen; corners open up a little as it grows
  // (like Atlys), then square off at the very end, where the phone's own corners take over.
  const frame = useAnimatedStyle(() => {
    const p = progress.get();
    const r = from.get();
    if (reduced) return { left: 0, top: 0, width: W, height: H, borderRadius: 0, opacity: p };
    return {
      left: r.x + (0 - r.x) * p,
      top: r.y + (0 - r.y) * p,
      width: r.width + (W - r.width) * p,
      height: r.height + (H - r.height) * p,
      borderRadius: interpolate(p, [0, 0.92, 1], [TILE_RADIUS, 44, 0], Extrapolation.CLAMP),
      opacity: 1,
    };
  });

  // Both faces are laid out at their own size and scaled to the frame's width, so text shrinks and
  // grows with the card instead of reflowing.
  const tileFace = useAnimatedStyle(() => {
    const p = progress.get();
    const r = from.get();
    const w = reduced ? W : r.width + (W - r.width) * p;
    const h = reduced ? H : r.height + (H - r.height) * p;
    const s = w / r.width;
    return {
      width: r.width,
      height: r.height,
      opacity: reduced ? 0 : interpolate(p, [0, 0.3], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: h - r.height * s }, { scale: s }],
    };
  });

  const heroFace = useAnimatedStyle(() => {
    const p = progress.get();
    const r = from.get();
    const w = reduced ? W : r.width + (W - r.width) * p;
    const h = reduced ? H : r.height + (H - r.height) * p;
    const s = w / W;
    return {
      opacity: reduced ? 1 : interpolate(p, [0.35, 0.85], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (h - H * s) / 2 }, { scale: s }],
    };
  });

  const tileScrim = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(progress.get(), [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const heroScrim = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(progress.get(), [0.15, 0.7], [0, 1], Extrapolation.CLAMP),
  }));

  if (!card) return null;
  const g = GRADIENTS.city;

  return (
    <View style={styles.layer}>
      <Animated.View style={[styles.frame, frame]}>
        <Image source={card.city.hero} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        <Animated.View style={[StyleSheet.absoluteFill, tileScrim]}>
          <LinearGradient colors={g.colors} locations={g.locations} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, heroScrim]}>
          <HeroScrim />
        </Animated.View>
        <Animated.View style={[styles.face, tileFace]}>
          <CityTileFace {...card.face} />
        </Animated.View>
        <Animated.View style={[styles.face, { width: W, height: H }, heroFace]}>
          <CityHeroContent
            city={card.city}
            stats={card.stats}
            width={W}
            height={H}
            insetTop={insets.top}
            insetBottom={insets.bottom}
            peek
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 },
  frame: { position: 'absolute', overflow: 'hidden', backgroundColor: '#000' },
  face: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
});
