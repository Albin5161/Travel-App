import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { light, shadows } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Albin's reel-scanner loader (references/animations/reel_scanner_svg_animation.html), rebuilt on the
// UI thread. Looping: three ripples, an accent arc travelling round a white orb, and the orb's icon
// cycling play → pin → sparkle. Done: the arc closes, a check draws in, the orb pops once.
const CYCLE = 2400;
const ARC_R = 31;
const ARC_LEN = 2 * Math.PI * ARC_R; // ≈ 195
const RIPPLE_EASE = Easing.bezierFn(0.4, 0, 0.2, 1);
const POP = { duration: 600, easing: Easing.bezier(0.23, 1, 0.32, 1) };

type Props = { done: boolean; size?: number };

export function ReelScanner({ done, size = 160 }: Props) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const d = useSharedValue(0);
  const k = size / 240;

  useEffect(() => {
    if (reduced) return;
    t.set(withRepeat(withTiming(1, { duration: CYCLE, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [reduced, t]);

  useEffect(() => {
    if (!done) return;
    cancelAnimation(t);
    d.set(withTiming(1, POP));
  }, [d, done, t]);

  // The arc spins while looping and closes into a full ring when done.
  const arcSpin = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.get() * 360}deg` }] }));
  const arcProps = useAnimatedProps(() => {
    const p = d.get();
    return { strokeDasharray: [48 + (ARC_LEN - 48) * p, (ARC_LEN - 48) * (1 - p) + 0.01] };
  });

  const orb = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * Math.sin(Math.PI * d.get()) }],
  }));

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: 24 * (1 - interpolate(d.get(), [0.15, 1], [0, 1], Extrapolation.CLAMP)),
  }));
  const check = useAnimatedStyle(() => {
    const p = interpolate(d.get(), [0.15, 0.6], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ scale: 0.6 + 0.4 * p }] };
  });

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={done ? 'Places found' : 'Reading the reel'}>
      <Svg width={size} height={size} viewBox="0 0 240 240" style={StyleSheet.absoluteFill}>
        {[0, 1, 2].map((i) => (
          <Ripple key={i} t={t} d={d} offset={i / 3} still={reduced} />
        ))}
      </Svg>

      <Animated.View
        style={[
          styles.orb,
          { width: 56 * k, height: 56 * k, borderRadius: 28 * k, marginLeft: -28 * k, marginTop: -28 * k },
          orb,
        ]}
      />

      <Animated.View style={[StyleSheet.absoluteFill, arcSpin]}>
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <AnimatedCircle
            cx={120}
            cy={120}
            r={ARC_R}
            fill="none"
            stroke={light.accent}
            strokeWidth={2}
            strokeLinecap="round"
            animatedProps={arcProps}
            // Start the arc at 12 o'clock.
            transform="rotate(-90 120 120)"
          />
        </Svg>
      </Animated.View>

      <Icon t={t} d={d} window={[0.8888, 0.22]} still={reduced}>
        <Path d="M116.5 112.5 L127.5 120 L116.5 127.5 Z" fill={light.ink} />
      </Icon>
      <Icon t={t} d={d} window={[0.22, 0.5555]} still={false} hideWhenStill={reduced}>
        <Path
          d="M120 109.5 C115.86 109.5 112.5 112.86 112.5 117 C112.5 122.5 120 130.5 120 130.5 C120 130.5 127.5 122.5 127.5 117 C127.5 112.86 124.14 109.5 120 109.5 Z M120 119.25 C118.76 119.25 117.75 118.24 117.75 117 C117.75 115.76 118.76 114.75 120 114.75 C121.24 114.75 122.25 115.76 122.25 117 C122.25 118.24 121.24 119.25 120 119.25 Z"
          fill={light.ink}
          fillRule="evenodd"
        />
      </Icon>
      <Icon t={t} d={d} window={[0.5555, 0.8888]} still={false} hideWhenStill={reduced}>
        <Path
          d="M120 109.5 C120 115.3 115.3 120 109.5 120 C115.3 120 120 124.7 120 130.5 C120 124.7 124.7 120 130.5 120 C124.7 120 120 115.3 120 109.5 Z"
          fill={light.ink}
        />
      </Icon>

      <Animated.View style={[StyleSheet.absoluteFill, check]}>
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <AnimatedPath
            d="M112.5 120 L117.5 125 L127.5 114.5"
            fill="none"
            stroke={light.ink}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[24, 24]}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Ripple({
  t,
  d,
  offset,
  still,
}: {
  t: SharedValue<number>;
  d: SharedValue<number>;
  offset: number;
  still: boolean;
}) {
  const props = useAnimatedProps(() => {
    if (still) return { r: 28, strokeOpacity: 0, strokeWidth: 1 };
    const p = RIPPLE_EASE((t.get() + 1 - offset) % 1);
    const fade = p < 0.8 ? 0.35 - (0.23 * p) / 0.8 : 0.12 * (1 - (p - 0.8) / 0.2);
    return {
      r: 28 * (1 + 1.85 * p),
      strokeOpacity: fade * (1 - d.get()),
      strokeWidth: 1.2 - 0.7 * p,
    };
  });
  return <AnimatedCircle cx={120} cy={120} fill="none" stroke={light.ink} animatedProps={props} />;
}

// One of the orb's cycling icons: visible inside `window` ([start, end] of the 2.4s cycle, wrapping),
// fading and shrinking to 65% across a 0.27s edge on either side.
function Icon({
  t,
  d,
  window: [start, end],
  still,
  hideWhenStill,
  children,
}: {
  t: SharedValue<number>;
  d: SharedValue<number>;
  window: [number, number];
  still: boolean;
  hideWhenStill?: boolean;
  children: ReactNode;
}) {
  const EDGE = 0.1111;
  const style = useAnimatedStyle(() => {
    let v: number;
    if (hideWhenStill) v = 0;
    else if (still) v = 1;
    else {
      const x = t.get();
      // Shift so the window starts at 0, which makes a wrapping window contiguous.
      const rel = (x - start + 1) % 1;
      const len = (end - start + 1) % 1;
      if (rel < EDGE) v = rel / EDGE;
      else if (rel <= len) v = 1;
      else if (rel < len + EDGE) v = 1 - (rel - len) / EDGE;
      else v = 0;
    }
    const gone = d.get();
    const o = v * (1 - Math.min(1, gone * 2.4));
    return { opacity: o, transform: [{ scale: (0.65 + 0.35 * v) * (1 - 0.5 * gone) }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 240 240">
        {children}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: light.panel,
    boxShadow: `${shadows.button}, 0 6px 20px rgba(17,17,17,0.06)`,
    transformOrigin: 'center',
  },
});
