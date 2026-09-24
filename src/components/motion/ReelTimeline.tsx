import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { light } from '@/theme/tokens';

type Marker = { id: string; at: number };

type Props = {
  width: number;
  /** True while the video is being read: the playhead scrubs. False once results are in. */
  watching: boolean;
  /** Each place's position in the video, 0 to 1. */
  markers: Marker[];
  /** How many markers have landed so far. They land in order, one per found place. */
  revealed: number;
  /** How long the scrub takes to reach the end. Matched to the extraction's wait. */
  watchMs: number;
};

const TRACK = 3;
const HEAD = 9;
const DOT = 10;
// A marker lands with a little overshoot, like something being pinned.
const POP = { duration: 420, dampingRatio: 0.5 } as const;

/** "1:04" to seconds. Hours never occur in a reel, so m:ss is enough. */
export function seconds(stamp: string | undefined) {
  if (!stamp) return 0;
  const [m, s] = stamp.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

/**
 * The video, drawn as its own timeline. While the link is read, a playhead scrubs across it: the
 * app is watching. When results arrive, a marker pops onto the timeline at the exact moment each
 * place was mentioned, so the list below is visibly *from* the video rather than from nowhere.
 */
export function ReelTimeline({ width, watching, markers, revealed, watchMs }: Props) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const headO = useSharedValue(1);

  useEffect(() => {
    headO.set(watching ? 1 : withTiming(0, { duration: 200 }));
    if (reduced) {
      p.set(watching ? 0.5 : 1);
      return;
    }
    // Watching eases toward the end without quite reaching it, so a slow extraction never shows a
    // finished bar that is still waiting. Results arriving close the last stretch.
    p.set(
      watching
        ? withTiming(0.92, { duration: watchMs, easing: Easing.out(Easing.quad) })
        : withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, [headO, p, reduced, watchMs, watching]);

  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: -(1 - p.get()) * width }] }));
  const head = useAnimatedStyle(() => ({
    transform: [{ translateX: p.get() * width - HEAD / 2 }],
    opacity: headO.get(),
  }));

  return (
    <View style={[styles.wrap, { width }]} pointerEvents="none">
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
      <Animated.View style={[styles.head, head]} />
      {markers.map((m, i) => (
        <MarkerDot key={m.id} x={m.at * width} shown={i < revealed} reduced={reduced} />
      ))}
    </View>
  );
}

function MarkerDot({ x, shown, reduced }: { x: number; shown: boolean; reduced: boolean }) {
  const s = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (!shown) return;
    if (reduced) {
      s.set(1);
      return;
    }
    s.set(withSpring(1, POP));
    ring.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })));
  }, [reduced, ring, s, shown]);

  const dot = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  const pulse = useAnimatedStyle(() => {
    const r = ring.get();
    return { opacity: r === 0 || r === 1 ? 0 : 0.7 * (1 - r), transform: [{ scale: 1 + r * 1.6 }] };
  });

  return (
    <View style={[styles.markerSlot, { left: x - DOT / 2 }]}>
      <Animated.View style={[styles.ring, pulse]} />
      <Animated.View style={[styles.dot, dot]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: DOT + 4, justifyContent: 'center' },
  track: {
    height: TRACK,
    borderRadius: TRACK / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)' },
  head: {
    position: 'absolute',
    left: 0,
    width: HEAD,
    height: HEAD,
    borderRadius: HEAD / 2,
    backgroundColor: light.photoInk,
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
  },
  markerSlot: { position: 'absolute', width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: light.accent,
    borderWidth: 2,
    borderColor: light.photoInk,
  },
  ring: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    borderColor: light.accent,
  },
});
