import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { fonts, light } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Albin's opening animation (references/animations/raahi_travel_app_opening_animation.html), in a
// 300×300 box: 0–0.6s a winding route draws itself with a light travelling at its tip; 0.35s a pin
// drops onto its end with a bounce and a ripple; 0.55s the pin shrinks into the dot of the "ı" while
// "Raahı" fades up letter by letter; 1.1–1.6s the route fades and the tagline appears. Then the
// whole layer fades away to reveal home.
const EASE = Easing.bezierFn(0.23, 1, 0.32, 1);
const BOUNCE = Easing.bezierFn(0.34, 1.56, 0.64, 1);
const TOTAL = 1600;
const HOLD = 250;
const FADE_OUT = 350;
const INK = light.ink;
const ACCENT = light.accent;

// Wordmark set in Instrument Serif 48, centred on x=150, baseline 166. Letter advances are the
// font's own (R .513, a .399, h .47, ı .223 em), so the dot lands exactly on the dotless i.
const SIZE = 48;
const WORD = ['R', 'a', 'a', 'h', 'ı'];
const ADVANCE = [0.513, 0.399, 0.399, 0.47, 0.223];
const X0 = 150 - (ADVANCE.reduce((a, b) => a + b, 0) * SIZE) / 2;
const LETTER_X = ADVANCE.map((_, i) => X0 + ADVANCE.slice(0, i).reduce((a, b) => a + b, 0) * SIZE);
const BASELINE = 166;
// Centre of the i's tittle: halfway across its stem, 0.62 em above the baseline.
const DOT = { x: LETTER_X[4] + 0.1135 * SIZE, y: BASELINE - 0.62 * SIZE };

// The route: two cubic curves ending at the dot.
const P0 = [30, 185];
const SEGMENTS = [
  [P0, [60, 225], [85, 120], [120, 150]],
  [
    [120, 150],
    [150, 175],
    [165, 103],
    [DOT.x, DOT.y],
  ],
] as const;
const ROUTE_D = `M ${P0[0]},${P0[1]} C 60,225 85,120 120,150 C 150,175 165,103 ${DOT.x},${DOT.y}`;

// Sample the route once so the travelling light can follow it by arc length.
const SAMPLES = (() => {
  const pts: { x: number; y: number; d: number }[] = [];
  let d = 0;
  let last: [number, number] | null = null;
  for (const [a, b, c, e] of SEGMENTS) {
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const u = 1 - t;
      const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0];
      const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1];
      if (last) d += Math.hypot(x - last[0], y - last[1]);
      last = [x, y];
      pts.push({ x, y, d });
    }
  }
  return pts;
})();
const ROUTE_LEN = SAMPLES[SAMPLES.length - 1].d;
const SX = SAMPLES.map((p) => p.x);
const SY = SAMPLES.map((p) => p.y);
const SD = SAMPLES.map((p) => p.d);

/** Progress through [start, start + dur] in ms, 0…1. */
function seg(t: number, start: number, dur: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - start) / dur));
}

type Props = { onDone: () => void };

export function LaunchIntro({ onDone }: Props) {
  const { width: W } = useWindowDimensions();
  const t = useSharedValue(0);
  const layer = useSharedValue(1);
  const box = Math.min(W, 380);

  useEffect(() => {
    const land = setTimeout(haptic.light, 600);
    t.set(withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear }));
    layer.set(
      withDelay(
        TOTAL + HOLD,
        withTiming(0, { duration: FADE_OUT, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(onDone);
        }),
      ),
    );
    return () => clearTimeout(land);
    // Mount-only: plays once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeFade = (x: number) => {
    'worklet';
    return 1 - EASE(seg(x, 1100, 500));
  };

  const route = useAnimatedProps(() => {
    const x = t.get();
    return { strokeDashoffset: ROUTE_LEN * (1 - EASE(seg(x, 0, 600))), opacity: routeFade(x) };
  });
  const glow = useAnimatedProps(() => {
    const x = t.get();
    return { strokeDashoffset: ROUTE_LEN * (1 - EASE(seg(x, 0, 600))), opacity: 0.18 * routeFade(x) };
  });
  const guide = useAnimatedProps(() => ({ opacity: 0.4 * routeFade(t.get()) * seg(t.get(), 0, 200) }));

  const particle = useAnimatedProps(() => {
    const x = t.get();
    const p = EASE(seg(x, 0, 600));
    const target = p * ROUTE_LEN;
    let i = 1;
    while (i < SD.length - 1 && SD[i] < target) i++;
    const f = (target - SD[i - 1]) / Math.max(0.0001, SD[i] - SD[i - 1]);
    const raw = seg(x, 0, 600);
    const o = raw < 0.1 ? raw / 0.1 : raw > 0.9 ? (1 - raw) / 0.1 : 1;
    return {
      cx: SX[i - 1] + (SX[i] - SX[i - 1]) * f,
      cy: SY[i - 1] + (SY[i] - SY[i - 1]) * f,
      opacity: x >= 600 ? 0 : o,
    };
  });

  // Waypoints pop in with a bounce (start at 50ms, midpoint at 280ms) and fade with the route.
  const wpStart = useAnimatedProps(() => {
    const x = t.get();
    const p = seg(x, 50, 300);
    return { opacity: Math.min(1, p * 1.3) * 0.7 * (1 - seg(x, 1100, 500)), r: 3 * BOUNCE(p) };
  });
  const wpMid = useAnimatedProps(() => {
    const x = t.get();
    const p = seg(x, 280, 300);
    return { opacity: Math.min(1, p * 1.3) * 0.7 * (1 - seg(x, 1100, 500)), r: 2.5 * BOUNCE(p) };
  });

  // Pin: drops in 350–700ms, then shrinks into the dot from 550ms.
  const pin = useAnimatedStyle(() => {
    const x = t.get();
    const drop = seg(x, 350, 350);
    const morph = EASE(seg(x, 550, 350));
    const d = BOUNCE(drop);
    const opacity = Math.min(1, drop * 3) * (1 - morph);
    const scale = (0.3 + 0.7 * d) * (1 - 0.9 * morph);
    return { opacity, transform: [{ translateY: (1 - d) * -35 * (box / 300) }, { scale }] };
  });
  const ripple = useAnimatedProps(() => {
    const p = seg(t.get(), 350, 500);
    const e = 1 - (1 - p) * (1 - p);
    return { r: 10 * (0.2 + 2 * e), opacity: p === 0 ? 0 : 0.8 * (1 - p), strokeWidth: 3 - 2.5 * p };
  });
  const dot = useAnimatedProps(() => {
    const p = seg(t.get(), 550, 350);
    return { r: 3.4 * (0.1 + 0.9 * BOUNCE(p)), opacity: p === 0 ? 0 : 1 };
  });

  const tagline = useAnimatedStyle(() => {
    const p = EASE(seg(t.get(), 1150, 650));
    return { opacity: 0.8 * p, transform: [{ translateY: (1 - p) * 6 * (box / 300) }] };
  });
  const layerStyle = useAnimatedStyle(() => ({ opacity: layer.get() }));

  // Pin geometry from the original, moved so its tip sits on the dot.
  const px = DOT.x - 197;
  const py = DOT.y - 133;

  return (
    <Animated.View style={[styles.layer, layerStyle]} accessibilityLabel="Raahi">
      <View style={{ width: box, height: box }}>
        <Svg width={box} height={box} viewBox="0 0 300 300" style={StyleSheet.absoluteFill}>
          <AnimatedPath
            d={ROUTE_D}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1}
            strokeDasharray="3 4"
            animatedProps={guide}
          />
          <AnimatedPath
            d={ROUTE_D}
            fill="none"
            stroke={ACCENT}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[ROUTE_LEN, ROUTE_LEN]}
            animatedProps={glow}
          />
          <AnimatedPath
            d={ROUTE_D}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[ROUTE_LEN, ROUTE_LEN]}
            animatedProps={route}
          />
          <AnimatedCircle cx={P0[0]} cy={P0[1]} fill={ACCENT} animatedProps={wpStart} />
          <AnimatedCircle cx={120} cy={150} fill={ACCENT} animatedProps={wpMid} />
          <AnimatedCircle r={4} fill={ACCENT} animatedProps={particle} />
          <AnimatedCircle cx={DOT.x} cy={DOT.y} fill="none" stroke={ACCENT} animatedProps={ripple} />
          <AnimatedCircle cx={DOT.x} cy={DOT.y} fill={ACCENT} animatedProps={dot} />
        </Svg>

        {/* The pin scales around its tip, so it gets its own layer with that transform origin. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transformOrigin: `${(DOT.x / 300) * box}px ${(DOT.y / 300) * box}px` },
            pin,
          ]}
        >
          <Svg width={box} height={box} viewBox="0 0 300 300">
            <G transform={`translate(${px}, ${py})`}>
              <Path
                d="M 197,133 C 191,126 188,121 188,115 C 188,109.5 192,105 197,105 C 202,105 206,109.5 206,115 C 206,121 203,126 197,133 Z"
                fill={ACCENT}
              />
              <Circle cx={197} cy={115} r={3.2} fill={light.canvas} />
            </G>
          </Svg>
        </Animated.View>

        {WORD.map((ch, i) => (
          <Letter key={i} t={t} index={i} box={box}>
            <SvgText x={LETTER_X[i]} y={BASELINE} fontFamily={fonts.serif} fontSize={SIZE} fill={INK}>
              {ch}
            </SvgText>
          </Letter>
        ))}

        <Animated.View style={[StyleSheet.absoluteFill, tagline]}>
          <Svg width={box} height={box} viewBox="0 0 300 300">
            <SvgText
              x={150}
              y={198}
              textAnchor="middle"
              fontFamily={fonts.sansSemi}
              fontSize={8}
              letterSpacing={2.6}
              fill={INK}
            >
              EVERY PATH HAS A STORY
            </SvgText>
            <Line
              x1={115}
              y1={207}
              x2={185}
              y2={207}
              stroke={ACCENT}
              strokeWidth={1}
              strokeLinecap="round"
              opacity={0.6}
            />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// Each letter fades up 14 units, 0.45s, starting at 0.55s with a 0.05s stagger.
function Letter({
  t,
  index,
  box,
  children,
}: {
  t: SharedValue<number>;
  index: number;
  box: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const p = EASE(seg(t.get(), 550 + index * 50, 450));
    return { opacity: p, transform: [{ translateY: (1 - p) * 14 * (box / 300) }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={box} height={box} viewBox="0 0 300 300">
        {children}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvas,
  },
});
