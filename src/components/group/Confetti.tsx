import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { seeded } from '@/data/group';
import { light } from '@/theme/tokens';

// One burst of paper confetti, for the moment the whole group agrees. Pieces are thrown up and out
// from a point, then fall under gravity, tumbling, and fade at the end. One shared clock drives
// every piece on the UI thread. Rare-tier delight: it plays once and never loops.

const COUNT = 28;
const DURATION = 1900;
const COLORS = [light.accent, light.ink, '#F4CDB0', '#C3DDD6', '#DAD1F3', '#F2B84B'];

type Piece = { vx: number; vy: number; spin: number; delay: number; color: string; w: number; h: number };

const PIECES: Piece[] = (() => {
  const rand = seeded(7);
  return Array.from({ length: COUNT }, (_, i) => ({
    vx: (rand() * 2 - 1) * 190,
    vy: -(220 + rand() * 240),
    spin: (rand() * 2 - 1) * 900,
    delay: rand() * 160,
    color: COLORS[i % COLORS.length],
    w: 6 + rand() * 4,
    h: 10 + rand() * 5,
  }));
})();

export function Confetti({ originY }: { originY: number }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(DURATION, { duration: DURATION, easing: Easing.linear }));
    // Mount-only: one burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PIECES.map((p, i) => (
        <Bit key={i} piece={p} t={t} x0={width / 2} y0={originY} fall={height - originY + 60} />
      ))}
    </View>
  );
}

function Bit({ piece, t, x0, y0, fall }: { piece: Piece; t: SharedValue<number>; x0: number; y0: number; fall: number }) {
  const style = useAnimatedStyle(() => {
    const life = DURATION - 200;
    const p = Math.max(0, Math.min(1, (t.get() - piece.delay) / life));
    // Up and out, then gravity takes over: y = vy·p + g·p², with g sized to clear the screen.
    const g = fall - piece.vy;
    return {
      opacity: p === 0 ? 0 : p > 0.8 ? (1 - p) / 0.2 : 1,
      transform: [
        { translateX: x0 + piece.vx * p - piece.w / 2 },
        { translateY: y0 + piece.vy * p + g * p * p },
        { rotate: `${piece.spin * p}deg` },
        { rotateX: `${piece.spin * 0.6 * p}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.bit, { width: piece.w, height: piece.h, backgroundColor: piece.color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', left: 0, top: 0, borderRadius: 2 },
});
