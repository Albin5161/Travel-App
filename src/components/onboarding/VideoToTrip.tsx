import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { places } from '@/data/catalog';
import type { Place } from '@/data/types';
import { fonts, light, shadows } from '@/theme/tokens';

import { cleared, EASE, EASE_MOVE, hold, LAND, seg, useLoop } from './loop';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The whole product in one loop. A video plays; each place it shows is spotted (a scan line,
// then its name), flies across to a map and lands as a numbered pin. With all three in, the route
// draws itself and the result reads out: places found, a day planned.
const CYCLE = 7600;
const FIRST = 0.04;
const SCENE = 0.16;
const scene = (i: number) => FIRST + i * SCENE;
const ROUTE: [number, number] = [0.56, 0.7];
const RESULT: [number, number] = [0.71, 0.76];

// A beach, a restaurant and a spot you only reach on foot: Xplore is for any place a video shows.
const STOPS = ['gok-om', 'gok-prema', 'gok-paradise'].map((id) => places[id]);
// Where each place lands on the map, as fractions of the map's width and height.
const PIN_AT = [
  { x: 0.36, y: 0.27 },
  { x: 0.74, y: 0.46 },
  { x: 0.42, y: 0.74 },
];
const PIN = 36;
const RESULT_H = 34;

type Pt = { x: number; y: number };

export function VideoToTrip({ active, width, height }: { active: boolean; width: number; height: number }) {
  const t = useLoop(active, CYCLE);

  const W = Math.min(width, 340);
  const VW = Math.round(W * 0.42);
  const VH = Math.round(Math.min(VW * 1.58, height - RESULT_H - 14));
  const MX = VW + 14;
  const MW = W - MX;
  const MY = 14;
  const MH = VH - 22;

  const pins = PIN_AT.map((p) => ({ x: MX + p.x * MW, y: MY + p.y * MH }));
  // Sparks leave the video's right edge at the height of the caption, where the place was named.
  const from = { x: VW - 6, y: VH - 44 };
  const route = useMemo(() => routeThrough(PIN_AT.map((p) => ({ x: p.x * MW, y: p.y * MH }))), [MW, MH]);

  return (
    <View
      style={{ width: W, height: VH + RESULT_H + 14 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="A video plays. A beach, a restaurant and a hidden beach from it land as pins on a map, and a route joins them into a day plan."
    >
      <MapCard t={t} x={MX} y={MY} w={MW} h={MH} route={route} />
      {STOPS.map((p, i) => (
        <Pin key={p.id} t={t} i={i} at={pins[i]} photo={p.photo} />
      ))}
      <VideoCard t={t} w={VW} h={VH} />
      {pins.map((to, i) => (
        <Spark key={i} t={t} i={i} from={from} to={to} />
      ))}
      <Result t={t} top={VH + 14} />
    </View>
  );
}

/** The saved video: one clip per place, a scan line as each is read, its name when it's found. */
function VideoCard({ t, w, h }: { t: SharedValue<number>; w: number; h: number }) {
  return (
    <View style={[styles.video, { width: w, height: h }]}>
      {STOPS.map((p, i) => (
        <Clip key={p.id} t={t} i={i} photo={p.photo} />
      ))}
      <LinearGradient
        colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
        locations={[0, 0.22, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Scan t={t} h={h} />
      <View style={styles.source}>
        <Ionicons name="logo-instagram" size={11} color={light.photoInk} />
        <Text style={styles.sourceText} numberOfLines={1}>
          @konkan.trails
        </Text>
      </View>
      <Play t={t} />
      {STOPS.map((p, i) => (
        <Caption key={p.id} t={t} i={i} name={p.name} maxWidth={w - 12} />
      ))}
      <Progress t={t} />
    </View>
  );
}

/** One clip. The first sits underneath; the others fade in over it, and all clear at the end. */
function Clip({ t, i, photo }: { t: SharedValue<number>; i: number; photo: Place['photo'] }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const s = scene(i);
    const on = i === 0 ? 1 : hold(x, s - 0.02, s + 0.01, 0.93, 0.98);
    // A slow push-in while the clip plays, so it reads as footage rather than a still.
    const push = seg(x, s - 0.02, s + SCENE + 0.04);
    return { opacity: on, transform: [{ scale: 1.1 - 0.08 * push }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
    </Animated.View>
  );
}

/** A line of light that sweeps the frame as each clip is read. */
function Scan({ t, h }: { t: SharedValue<number>; h: number }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const local = (x - FIRST) / SCENE;
    const i = Math.floor(local);
    const f = (local - i) / 0.4;
    const live = i >= 0 && i < STOPS.length && f >= 0 && f <= 1;
    return {
      opacity: live ? Math.min(1, f * 5, (1 - f) * 5) : 0,
      transform: [{ translateY: live ? EASE_MOVE(f) * (h - 4) : 0 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.scan, style]} />;
}

/** The play button, there before the video starts and gone once it does. */
function Play({ t }: { t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const on = Math.max(1 - seg(x, 0.01, 0.045), seg(x, 0.95, 0.99));
    return { opacity: on, transform: [{ scale: 0.9 + 0.1 * on }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.play, style]}>
      <Ionicons name="play" size={18} color={light.photoInk} style={styles.playGlyph} />
    </Animated.View>
  );
}

/** The found place, named on the clip in the accent: this is the thing Xplore pulled out. */
function Caption({ t, i, name, maxWidth }: { t: SharedValue<number>; i: number; name: string; maxWidth: number }) {
  const style = useAnimatedStyle(() => {
    const s = scene(i);
    const on = hold(t.get(), s + 0.055, s + 0.08, s + 0.145, s + 0.165);
    return { opacity: on, transform: [{ translateY: (1 - EASE(on)) * 6 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.caption, { maxWidth }, style]}>
      <Feather name="map-pin" size={10} color={light.ctaInk} />
      <Text style={styles.captionText} numberOfLines={1}>
        {name}
      </Text>
    </Animated.View>
  );
}

function Progress({ t }: { t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    return {
      opacity: 1 - cleared(x),
      transform: [{ scaleX: Math.max(0.001, seg(x, FIRST, scene(STOPS.length))) }],
    };
  });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

/** A found place in flight: a spark with a short tail, arcing from the video to its spot on the map. */
function Spark({ t, i, from, to }: { t: SharedValue<number>; i: number; from: Pt; to: Pt }) {
  return (
    <>
      {[0.14, 0.07, 0].map((lag, k) => (
        <SparkDot key={k} t={t} i={i} from={from} to={to} lag={lag} size={k === 2 ? 10 : 6} />
      ))}
    </>
  );
}

function SparkDot({
  t,
  i,
  from,
  to,
  lag,
  size,
}: {
  t: SharedValue<number>;
  i: number;
  from: Pt;
  to: Pt;
  lag: number;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const s = scene(i);
    const a = seg(t.get(), s + 0.08, s + 0.14) - lag;
    const live = a > 0 && a < 1;
    const e = EASE_MOVE(Math.max(0, Math.min(1, a)));
    // A quadratic arc that lifts above the straight line between the two points.
    const cx = (from.x + to.x) / 2;
    const cy = Math.min(from.y, to.y) - 46;
    const u = 1 - e;
    const x = u * u * from.x + 2 * u * e * cx + e * e * to.x;
    const y = u * u * from.y + 2 * u * e * cy + e * e * to.y;
    return {
      opacity: live ? Math.min(1, a * 8, (1 - a) * 8) * (lag ? 0.45 : 1) : 0,
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.spark, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

/** A paper map of the coast: sea on the left, a couple of roads, and the route once the day is planned. */
function MapCard({
  t,
  x,
  y,
  w,
  h,
  route,
}: {
  t: SharedValue<number>;
  x: number;
  y: number;
  w: number;
  h: number;
  route: { d: string; length: number };
}) {
  const routeProps = useAnimatedProps(() => {
    const v = t.get();
    return {
      strokeDashoffset: route.length * (1 - EASE_MOVE(seg(v, ROUTE[0], ROUTE[1]))),
      strokeOpacity: 1 - cleared(v),
    };
  });
  return (
    <View style={[styles.map, { left: x, top: y, width: w, height: h }]}>
      <Svg width={w} height={h}>
        <Path
          d={`M0 0 H${w * 0.2} C${w * 0.3} ${h * 0.28} ${w * 0.1} ${h * 0.5} ${w * 0.2} ${h * 0.74} S${w * 0.16} ${h} ${w * 0.22} ${h} H0 Z`}
          fill={light.mapSea}
          stroke={light.mapCoast}
          strokeWidth={1}
        />
        <Path
          d={`M${w * 0.26} ${h} C${w * 0.4} ${h * 0.7} ${w * 0.6} ${h * 0.64} ${w} ${h * 0.58}`}
          stroke={light.mapRoad}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={`M${w * 0.5} 0 C${w * 0.56} ${h * 0.3} ${w * 0.9} ${h * 0.34} ${w} ${h * 0.24}`}
          stroke={light.mapRoad}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          d={route.d}
          stroke={light.accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={[route.length, route.length]}
          animatedProps={routeProps}
        />
      </Svg>
      <Text style={styles.mapLabel}>Gokarna</Text>
    </View>
  );
}

/** A place, landed: its photo in an accent ring, numbered in the order of the day. */
function Pin({ t, i, at, photo }: { t: SharedValue<number>; i: number; at: Pt; photo: Place['photo'] }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const s = scene(i);
    const a = seg(x, s + 0.135, s + 0.2);
    const land = LAND(a);
    return {
      opacity: Math.min(1, a * 4) * (1 - cleared(x)),
      transform: [{ translateY: (1 - land) * -16 }, { scale: 0.9 + 0.1 * land }],
    };
  });
  return (
    <Animated.View style={[styles.pin, { left: at.x - PIN / 2, top: at.y - PIN / 2 }, style]}>
      <View style={styles.pinPhoto}>
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      </View>
      <View style={styles.pinBadge}>
        <Text style={styles.pinNumber}>{i + 1}</Text>
      </View>
    </Animated.View>
  );
}

function Result({ t, top }: { t: SharedValue<number>; top: number }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const a = seg(x, RESULT[0], RESULT[1]);
    return { opacity: a * (1 - cleared(x)), transform: [{ translateY: (1 - EASE(a)) * 8 }] };
  });
  return (
    <Animated.View style={[styles.result, { top }, style]}>
      <Feather name="check" size={13} color={light.accent} />
      <Text variant="label">3 places found</Text>
      <View style={styles.dot} />
      <Text variant="label" color={light.inkSoft}>
        Day 1 planned
      </Text>
    </Animated.View>
  );
}

/** A smooth path through the pins, bowing gently between each pair, with its measured length. */
function routeThrough(pts: Pt[]) {
  let d = `M${pts[0].x} ${pts[0].y}`;
  let length = 0;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1];
    const b = pts[k];
    // Bow each leg sideways by a fifth of its length, alternating sides.
    const nx = -(b.y - a.y) * 0.2 * (k % 2 ? 1 : -1);
    const ny = (b.x - a.x) * 0.2 * (k % 2 ? 1 : -1);
    const c = { x: (a.x + b.x) / 2 + nx, y: (a.y + b.y) / 2 + ny };
    d += ` Q${c.x} ${c.y} ${b.x} ${b.y}`;
    let last = a;
    for (let s = 1; s <= 24; s++) {
      const e = s / 24;
      const u = 1 - e;
      const p = { x: u * u * a.x + 2 * u * e * c.x + e * e * b.x, y: u * u * a.y + 2 * u * e * c.y + e * e * b.y };
      length += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
    }
  }
  return { d, length: Math.ceil(length) + 1 };
}

const styles = StyleSheet.create({
  video: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: light.canvasTop,
    borderWidth: 3,
    borderColor: light.panel,
    boxShadow: shadows.card,
    transform: [{ rotate: '-2.5deg' }],
  },
  scan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: light.accent,
    boxShadow: `0 0 14px 2px ${light.accent}`,
  },
  source: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceText: { fontFamily: fonts.sansSemi, fontSize: 10, lineHeight: 13, color: light.photoInk },
  play: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1,
    borderColor: light.photoLine,
  },
  playGlyph: { marginLeft: 3 },
  caption: {
    position: 'absolute',
    left: 6,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: light.accent,
  },
  captionText: { flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: 10.5, lineHeight: 14, color: light.ctaInk },
  track: {
    position: 'absolute',
    left: 9,
    right: 9,
    bottom: 9,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  fill: { flex: 1, backgroundColor: light.photoInk, transformOrigin: 'left' },
  spark: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: light.accent,
    borderWidth: 1.5,
    borderColor: light.panel,
  },
  map: {
    position: 'absolute',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: light.mapLand,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.card,
  },
  mapLabel: {
    position: 'absolute',
    right: 10,
    top: 9,
    fontFamily: fonts.sansSemi,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: light.mapLabel,
  },
  pin: { position: 'absolute', width: PIN, height: PIN, boxShadow: shadows.pin, borderRadius: PIN / 2 },
  pinPhoto: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: light.accent,
    backgroundColor: light.canvasTop,
  },
  pinBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.ink,
    borderWidth: 1.5,
    borderColor: light.panel,
  },
  pinNumber: { fontFamily: fonts.sansSemi, fontSize: 9, lineHeight: 11, color: light.ctaInk },
  result: {
    position: 'absolute',
    alignSelf: 'center',
    height: RESULT_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.button,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: light.inkFaint },
});
