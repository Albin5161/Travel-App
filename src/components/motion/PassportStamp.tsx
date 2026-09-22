import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, Path, Text as SvgText, TextPath } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { fonts, light } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Albin's passport stamp (references/animations/raahi_passport_stamp_animation.html). Over 1.1s:
// the stamp drops from 1.6× and -12° to land at -6° in 0.35s (fast, ease-in, a haptic thud on
// impact), squashes to 0.96, rebounds to 1.01 and settles, while an ink ring spreads from the
// impact and fades. Then it holds briefly and hands back. Tap to skip.
const DROP = Easing.bezierFn(0.55, 0, 1, 0.45);
const OUT = Easing.bezierFn(0, 0, 0.58, 1);
const INOUT = Easing.bezierFn(0.42, 0, 0.58, 1);
const RING = Easing.bezierFn(0.1, 0.8, 0.3, 1);
const TOTAL = 1100;
const IMPACT = 350;
const HOLD = 700;
const INK = light.accent;

type Props = { city: string; date: Date; onDone: () => void; size?: number };

export function PassportStamp({ city, date, onDone: onDoneProp, size = 260 }: Props) {
  const reduced = useReducedMotion();
  // Finishes once, whether the timeline ends or the user taps to skip.
  const finished = useRef(false);
  const onDone = () => {
    if (finished.current) return;
    finished.current = true;
    onDoneProp();
  };
  const t = useSharedValue(0);
  const veil = useSharedValue(0);

  useEffect(() => {
    veil.set(withTiming(1, { duration: 200 }));
    if (reduced) {
      t.set(TOTAL);
      const done = setTimeout(onDone, 900);
      return () => clearTimeout(done);
    }
    const thud = setTimeout(haptic.thud, IMPACT);
    t.set(
      withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(later, onDone);
      }),
    );
    return () => clearTimeout(thud);
    // Mount-only: the stamp lands once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stamp = useAnimatedStyle(() => {
    const x = t.get();
    let scale: number;
    let rotate: number;
    let opacity = 0.9;
    if (x < IMPACT) {
      const p = DROP(x / IMPACT);
      scale = 1.6 - 0.6 * p;
      rotate = -12 + 6 * p;
      opacity = 0.9 * p;
    } else {
      rotate = -6;
      if (x < 500) scale = 1 - 0.04 * OUT((x - IMPACT) / 150);
      else if (x < 650) scale = 0.96 + 0.05 * INOUT((x - 500) / 150);
      else scale = 1.01 - 0.01 * INOUT(Math.min(1, (x - 650) / 450));
    }
    return { opacity, transform: [{ scale }, { rotate: `${rotate}deg` }] };
  });

  const ring = useAnimatedProps(() => {
    const x = t.get();
    if (x < IMPACT) return { r: 82, strokeOpacity: 0, strokeWidth: 3 };
    const p = RING(Math.min(1, (x - IMPACT) / 475));
    return { r: 82 * (0.95 + 0.5 * p), strokeOpacity: 0.7 * (1 - p), strokeWidth: 3 - 2.5 * p };
  });

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));
  const label = stampDate(date);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityLabel={`Day planned in ${city}`}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} />
      <View style={styles.center}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
            <AnimatedCircle cx={100} cy={100} fill="none" stroke={INK} animatedProps={ring} />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, stamp]}>
            <StampArt city={city.toUpperCase()} date={label} size={size} />
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

// "22 SEP 2026", spelled out so no locale turns it into "SEPT".
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function stampDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function later(onDone: () => void) {
  setTimeout(onDone, HOLD);
}

// The stamp itself: a worn double ring, curved "RAAHI · DAY PLANNED", the city in serif capitals,
// a star between rules, and the date. (The web version roughens the ink with an SVG turbulence
// filter, which react-native-svg doesn't support; broken dashes in the rings give the worn edge.)
function StampArt({ city, date, size }: { city: string; date: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <Path id="stamp-arc" d="M 38.5,100 A 61.5,61.5 0 1,1 161.5,100" />
      </Defs>
      <Circle
        cx={100}
        cy={100}
        r={82}
        fill="none"
        stroke={INK}
        strokeWidth={2}
        strokeDasharray="160 3 90 2 110 3"
        strokeLinecap="round"
      />
      <Circle
        cx={100}
        cy={100}
        r={73}
        fill="none"
        stroke={INK}
        strokeWidth={1}
        strokeDasharray="190 2 120 1.5"
        strokeLinecap="round"
      />
      <SvgText fill={INK} fontFamily={fonts.sansSemi} fontSize={10} letterSpacing={2.2} textAnchor="middle">
        <TextPath href="#stamp-arc" startOffset="50%" textAnchor="middle">
          RAAHI · DAY PLANNED
        </TextPath>
      </SvgText>
      <Path
        d="M 44 100 L 45.2 103.2 L 48.5 103.2 L 45.8 105.2 L 46.8 108.3 L 44 106.3 L 41.2 108.3 L 42.2 105.2 L 39.5 103.2 L 42.8 103.2 Z"
        fill={INK}
      />
      <Path
        d="M 156 100 L 157.2 103.2 L 160.5 103.2 L 157.8 105.2 L 158.8 108.3 L 156 106.3 L 153.2 108.3 L 154.2 105.2 L 151.5 103.2 L 154.8 103.2 Z"
        fill={INK}
      />
      <Line x1={58} y1={78} x2={142} y2={78} stroke={INK} strokeWidth={1} strokeDasharray="2 2" />
      <SvgText
        x={100}
        y={104}
        textAnchor="middle"
        fontFamily={fonts.serif}
        fontSize={city.length > 8 ? 20 : 24}
        fill={INK}
        letterSpacing={3}
      >
        {city}
      </SvgText>
      <G transform="translate(100, 117) scale(0.85)">
        <Path
          d="M 0 -6 L 1.8 -1.8 L 6.3 -1.8 L 2.7 0.9 L 4 5.4 L 0 2.7 L -4 5.4 L -2.7 0.9 L -6.3 -1.8 L -1.8 -1.8 Z"
          fill={INK}
        />
        <Line x1={-24} y1={0} x2={-10} y2={0} stroke={INK} strokeWidth={1} />
        <Line x1={10} y1={0} x2={24} y2={0} stroke={INK} strokeWidth={1} />
      </G>
      <SvgText
        x={100}
        y={138}
        textAnchor="middle"
        fontFamily={fonts.sansMedium}
        fontSize={10}
        fill={INK}
        letterSpacing={2}
      >
        {date}
      </SvgText>
      <Line x1={65} y1={146} x2={135} y2={146} stroke={INK} strokeWidth={0.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: 'rgba(245,244,241,0.94)' },
  center: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});
