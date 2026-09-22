import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { light } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Albin's "saved" confirmation (references/animations/saved_place_confirmation_micro_svg_animation.html):
// 0–0.35s an ink circle pops in with a small overshoot, 0.15–0.45s a white check draws itself,
// 0.3–0.7s six accent dots burst outward and fade. One shot, 0.7s, played on mount.
const TOTAL = 700;
const POP = Easing.bezierFn(0.34, 1.56, 0.64, 1);
const DRAW = Easing.bezierFn(0.25, 1, 0.5, 1);
const BURST = Easing.bezierFn(0.16, 1, 0.3, 1);
const CHECK_LEN = 26;

// Unit vectors for the six dots, clockwise from the top.
const DIRS = [0, 60, 120, 180, 240, 300].map((deg) => {
  const r = ((deg - 90) * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)] as const;
});

type Props = { size?: number };

export function SavedTick({ size = 64 }: Props) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? TOTAL : 0);

  useEffect(() => {
    if (reduced) return;
    t.set(withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear }));
  }, [reduced, t]);

  const circle = useAnimatedStyle(() => {
    const p = Math.min(1, t.get() / 350);
    return { opacity: Math.min(1, p * 1.6), transform: [{ scale: 0.6 + 0.4 * POP(p) }] };
  });

  const check = useAnimatedProps(() => {
    const p = interpolate(t.get(), [150, 450], [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: CHECK_LEN * (1 - DRAW(p)) };
  });

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <Animated.View style={[StyleSheet.absoluteFill, circle]}>
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Circle cx={32} cy={32} r={24} fill={light.ink} />
          <AnimatedPath
            d="M23 32.5 L29 38.5 L41 26.5"
            stroke={light.ctaInk}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[CHECK_LEN, CHECK_LEN]}
            animatedProps={check}
          />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        {DIRS.map(([dx, dy], i) => (
          <Dot key={i} t={t} dx={dx} dy={dy} hidden={reduced} />
        ))}
      </Svg>
    </View>
  );
}

function Dot({ t, dx, dy, hidden }: { t: SharedValue<number>; dx: number; dy: number; hidden: boolean }) {
  const props = useAnimatedProps(() => {
    if (hidden) return { cx: 32, cy: 32, r: 1.75, opacity: 0 };
    const p = interpolate(t.get(), [300, 700], [0, 1], Extrapolation.CLAMP);
    const e = BURST(p);
    const dist = 22 + 9 * e;
    return {
      cx: 32 + dx * dist,
      cy: 32 + dy * dist,
      r: 1.75 * (0.5 + 0.5 * e),
      opacity: p === 0 ? 0 : p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6,
    };
  });
  return <AnimatedCircle fill={light.accent} animatedProps={props} />;
}
