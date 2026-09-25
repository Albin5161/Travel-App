import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { places } from '@/data/catalog';
import type { Place } from '@/data/types';
import { light, shadows } from '@/theme/tokens';

import { cleared, EASE_MOVE, LAND, seg, useLoop } from './loop';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A Saturday out from home: the road draws from your front door to two spots you saved nearby, a
// marker riding its tip, and each spot lands as the road reaches it.
const CYCLE = 5600;
const DRIVE: [number, number] = [0.06, 0.5];
const STRIP_H = 78;
const STOP = 40;
const HOME = 30;
const PAD = 18;

const STOPS = [places['ktm-illickal'], places['ktm-marmala']];

type Pt = { x: number; y: number };

export function WeekendRoute({ active, width, homeName }: { active: boolean; width: number; homeName: string }) {
  const t = useLoop(active, CYCLE);
  const W = Math.min(width, 300);
  const road = useMemo(() => roadFor(W - PAD * 2), [W]);

  return (
    <View
      style={[styles.card, { width: W }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`A day trip from ${homeName} to ${STOPS.map((s) => s.name).join(' and ')}.`}
    >
      <View style={{ height: STRIP_H }}>
        <Road t={t} road={road} />
        <View style={[styles.home, { left: road.home.x - HOME / 2, top: road.home.y - HOME / 2 }]}>
          <Feather name="home" size={14} color={light.ctaInk} />
        </View>
        {STOPS.map((p, i) => (
          <Stop key={p.id} t={t} at={road.stops[i]} reach={road.reach[i]} photo={p.photo} />
        ))}
        <Tip t={t} road={road} />
      </View>
      <View style={styles.text}>
        <Text variant="micro">Saturday · from {homeName}</Text>
        <Text variant="title">
          {STOPS[0].name} and {STOPS[1].name}
        </Text>
        <Text variant="data">2 stops · back by dinner · about ₹250</Text>
      </View>
    </View>
  );
}

function progress(t: number) {
  'worklet';
  return EASE_MOVE(seg(t, DRIVE[0], DRIVE[1]));
}

function Road({ t, road }: { t: SharedValue<number>; road: RoadShape }) {
  const props = useAnimatedProps(() => {
    const x = t.get();
    return { strokeDashoffset: road.length * (1 - progress(x)), strokeOpacity: 1 - cleared(x) };
  });
  return (
    <Svg width={road.width} height={STRIP_H} style={StyleSheet.absoluteFill}>
      <Path d={road.d} stroke={light.mapTrail} strokeWidth={1.5} strokeDasharray={[2, 5]} strokeLinecap="round" fill="none" />
      <AnimatedPath
        d={road.d}
        stroke={light.accent}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={[road.length, road.length]}
        animatedProps={props}
      />
    </Svg>
  );
}

/** The car, as a dot riding the end of the drawn road. Gone once it arrives. */
function Tip({ t, road }: { t: SharedValue<number>; road: RoadShape }) {
  const { xs, ys, ds, length } = road;
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const q = progress(x);
    const target = q * length;
    let k = 0;
    while (k < ds.length - 1 && ds[k + 1] < target) k++;
    const live = x > DRIVE[0] && q < 0.995;
    return {
      opacity: live ? 1 : 0,
      transform: [{ translateX: xs[k] - 6 }, { translateY: ys[k] - 6 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.tip, style]} />;
}

/** A saved spot along the way, landing as the road reaches it. */
function Stop({ t, at, reach, photo }: { t: SharedValue<number>; at: Pt; reach: number; photo: Place['photo'] }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const a = seg(progress(x), reach - 0.06, reach + 0.02);
    const land = LAND(a);
    return {
      opacity: Math.min(1, a * 3) * (1 - cleared(x)),
      transform: [{ translateY: (1 - land) * -12 }, { scale: 0.9 + 0.1 * land }],
    };
  });
  return (
    <Animated.View style={[styles.stop, { left: at.x - STOP / 2, top: at.y - STOP / 2 }, style]}>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

type RoadShape = ReturnType<typeof roadFor>;

/** Home on the left, two stops along a winding road; sampled so the tip can ride it by distance. */
function roadFor(width: number) {
  const home = { x: HOME / 2 + 2, y: 50 };
  const stops = [
    { x: width * 0.55, y: 28 },
    { x: width - STOP / 2 - 2, y: 46 },
  ];
  const c1 = { x: width * 0.26, y: 82 };
  // Smooth through the first stop: the second control mirrors the first across it.
  const c2 = { x: 2 * stops[0].x - c1.x, y: 2 * stops[0].y - c1.y };
  const legs = [
    [home, c1, stops[0]],
    [stops[0], c2, stops[1]],
  ] as const;

  const xs: number[] = [home.x];
  const ys: number[] = [home.y];
  const ds: number[] = [0];
  const reachAt: number[] = [];
  let length = 0;
  for (const [a, c, b] of legs) {
    for (let s = 1; s <= 40; s++) {
      const e = s / 40;
      const u = 1 - e;
      const x = u * u * a.x + 2 * u * e * c.x + e * e * b.x;
      const y = u * u * a.y + 2 * u * e * c.y + e * e * b.y;
      length += Math.hypot(x - xs[xs.length - 1], y - ys[ys.length - 1]);
      xs.push(x);
      ys.push(y);
      ds.push(length);
    }
    reachAt.push(length);
  }
  return {
    width,
    home,
    stops,
    xs,
    ys,
    ds,
    length,
    reach: reachAt.map((d) => d / length),
    d: `M${home.x} ${home.y} Q${c1.x} ${c1.y} ${stops[0].x} ${stops[0].y} T${stops[1].x} ${stops[1].y}`,
  };
}

const styles = StyleSheet.create({
  card: {
    padding: PAD,
    gap: 14,
    borderRadius: 24,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.card,
  },
  home: {
    position: 'absolute',
    width: HOME,
    height: HOME,
    borderRadius: HOME / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.ink,
    boxShadow: shadows.pin,
  },
  stop: {
    position: 'absolute',
    width: STOP,
    height: STOP,
    borderRadius: STOP / 2,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: light.accent,
    backgroundColor: light.canvasTop,
    boxShadow: shadows.pin,
  },
  tip: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: light.accent,
    borderWidth: 2,
    borderColor: light.panel,
    boxShadow: shadows.pin,
  },
  text: { gap: 3 },
});
