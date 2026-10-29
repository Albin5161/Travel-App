import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { EASE_OUT, SPRING_LAND, SPRING_SETTLE } from '@/lib/motion';
import { colors } from '@/theme/tokens';

// A 3D picture that answers a touch (Albin, 30 Oct 2026, after Airbnb's 3D icons): it squashes
// while pressed like a toy, hops and wobbles when let go, and plays its own small story on top. The
// pictures are flat images, so the stories are drawn over them: smoke from the house's chimney,
// sparkles in the city's windows, a ring where the pin lands or the stamp comes down.

/** The sparkles' warm gold: a window catching the light. */
const GLINT = '#F5C451';

/** Smoke: a warm grey that still shows on the white page, soft-edged rather than outlined. */
const SMOKE = '#DAD4CB';

/** The story an icon plays. `at` is where it happens, as fractions of the picture. */
export type Story = { kind: 'smoke' | 'sparkle' | 'ring'; at: { x: number; y: number } };

type Props = {
  source: number;
  size: number;
  story?: Story;
  /** Held down right now (a parent that owns the press passes this). */
  pressed?: boolean;
  /** Bumped by a parent to play the hop and the story. */
  played?: number;
  /** The picture takes its own taps (when nothing around it is pressable). */
  tappable?: boolean;
  /** Plays once, a moment after it appears: for a picture alone on an empty screen. */
  playOnShow?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Icon3D({ source, size, story, pressed: heldOutside = false, played: playedOutside = 0, tappable = false, playOnShow = false, style }: Props) {
  const [held, setHeld] = useState(false);
  const [playedHere, setPlayedHere] = useState(0);
  useEffect(() => {
    if (!playOnShow) return;
    const t = setTimeout(() => setPlayedHere((n) => n + 1), 400);
    return () => clearTimeout(t);
  }, [playOnShow]);
  const body = (
    <Picture source={source} size={size} story={story} pressed={heldOutside || held} played={playedOutside + playedHere} style={tappable ? undefined : style} />
  );
  if (!tappable) return body;
  return (
    <Pressable
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      onPress={() => setPlayedHere((n) => n + 1)}
      style={style}
      // Only for delight: there's nothing to do here for a screen reader.
      accessible={false}
      importantForAccessibility="no"
    >
      {body}
    </Pressable>
  );
}

function Picture({ source, size, story, pressed, played, style }: Omit<Props, 'tappable' | 'playOnShow'> & { pressed: boolean; played: number }) {
  const reduced = useReducedMotion();
  const lift = useSharedValue(0);
  const tilt = useSharedValue(0);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const beat = useSharedValue(0);

  // Pressed: lower and wider, like a soft toy under a thumb. Let go: back up on a spring.
  useEffect(() => {
    if (reduced) return;
    squashX.set(withSpring(pressed ? 1.08 : 1, SPRING_SETTLE));
    squashY.set(withSpring(pressed ? 0.86 : 1, SPRING_SETTLE));
  }, [pressed, reduced, squashX, squashY]);

  // Each play: a hop with a wobble and a stretch on the way up, then the story.
  const last = useRef(played);
  useEffect(() => {
    if (played === last.current) return;
    last.current = played;
    if (reduced) return;
    lift.set(withSequence(withTiming(-size * 0.24, { duration: 150, easing: EASE_OUT }), withSpring(0, SPRING_LAND)));
    tilt.set(withSequence(withTiming(-10, { duration: 90 }), withTiming(8, { duration: 120 }), withTiming(-3, { duration: 110 }), withSpring(0, SPRING_SETTLE)));
    squashY.set(withSequence(withTiming(1.12, { duration: 150, easing: EASE_OUT }), withTiming(0.9, { duration: 120 }), withSpring(1, SPRING_LAND)));
    squashX.set(withSequence(withTiming(0.94, { duration: 150, easing: EASE_OUT }), withTiming(1.08, { duration: 120 }), withSpring(1, SPRING_LAND)));
    // From the start every time, even if the last story hadn't finished.
    beat.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 900 })));
  }, [played, reduced, size, lift, tilt, squashX, squashY, beat]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }, { rotate: `${tilt.get()}deg` }, { scaleX: squashX.get() }, { scaleY: squashY.get() }],
    // Squash from the base, not the middle, so it sits on the ground.
    transformOrigin: 'center bottom',
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
      </Animated.View>
      {story && !reduced ? <StoryLayer story={story} size={size} beat={beat} /> : null}
    </View>
  );
}

/** The story's bits: each one runs across part of the beat (0 → 1), staggered. */
function StoryLayer({ story, size, beat }: { story: Story; size: number; beat: SharedValue<number> }) {
  const x = story.at.x * size;
  const y = story.at.y * size;
  if (story.kind === 'smoke') {
    return (
      <>
        <Bit beat={beat} from={0.1} to={0.75} x={x} y={y} size={size * 0.2} dx={size * 0.1} dy={-size * 0.42} color={SMOKE} />
        <Bit beat={beat} from={0.25} to={0.95} x={x + size * 0.03} y={y} size={size * 0.15} dx={size * 0.2} dy={-size * 0.34} color={SMOKE} />
      </>
    );
  }
  if (story.kind === 'sparkle') {
    return (
      <>
        <Spark beat={beat} from={0.15} to={0.55} x={x - size * 0.16} y={y - size * 0.08} size={size * 0.2} />
        <Spark beat={beat} from={0.3} to={0.7} x={x + size * 0.14} y={y + size * 0.02} size={size * 0.16} />
        <Spark beat={beat} from={0.45} to={0.9} x={x} y={y - size * 0.26} size={size * 0.13} />
      </>
    );
  }
  return <Ring beat={beat} from={0.2} to={0.85} x={x} y={y} size={size * 0.7} />;
}

/** A puff that rises, grows and fades. */
function Bit({ beat, from, to, x, y, size, dx, dy, color }: { beat: SharedValue<number>; from: number; to: number; x: number; y: number; size: number; dx: number; dy: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (beat.get() - from) / (to - from)));
    const on = t > 0 && t < 1;
    return {
      opacity: on ? (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75) : 0,
      transform: [{ translateX: dx * t }, { translateY: dy * t }, { scale: 0.5 + t * 0.8 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color, boxShadow: `0 0 ${Math.round(size * 0.35)}px ${color}` }, style]} />;
}

/** A four-pointed glint that pops and fades: two crossed bars, turned. */
function Spark({ beat, from, to, x, y, size }: { beat: SharedValue<number>; from: number; to: number; x: number; y: number; size: number }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (beat.get() - from) / (to - from)));
    const s = t <= 0 || t >= 1 ? 0 : t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
    return { opacity: s, transform: [{ scale: s }, { rotate: `${45 * t}deg` }] };
  });
  const bar = { position: 'absolute' as const, backgroundColor: GLINT, borderRadius: size };
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size }, style]}>
      <View style={[bar, { left: size * 0.42, top: 0, width: size * 0.16, height: size }]} />
      <View style={[bar, { top: size * 0.42, left: 0, height: size * 0.16, width: size }]} />
    </Animated.View>
  );
}

/** A thin ring that spreads out from where something landed. */
function Ring({ beat, from, to, x, y, size }: { beat: SharedValue<number>; from: number; to: number; x: number; y: number; size: number }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (beat.get() - from) / (to - from)));
    return { opacity: t <= 0 || t >= 1 ? 0 : 1 - t, transform: [{ scaleX: 0.3 + t }, { scaleY: (0.3 + t) * 0.45 }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.ember }, style]} />;
}
