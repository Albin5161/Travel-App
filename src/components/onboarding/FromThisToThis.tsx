import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import Ionicons from '@/components/Ionicons';
import { Text } from '@/components/Text';
import { places, smallPhoto } from '@/data/catalog';
import { fonts } from '@/theme/tokens';

// The whole product as one still picture: a reel on the left, the map it became on the right, both
// cards tilted towards each other in depth, with a note in handwriting over each ("From this…",
// "…to this"). They float a little while the page is on screen; with Reduce Motion they hold still.

const ROUTE = '#FF7A45';
const INK = '#18202E';
// The notes and their arrows sit on the sky, not on a card: light, like the rest of the sky's type.
const NOTE_INK = 'rgba(255,255,255,0.92)';
const NOTE_FONT = 'CaveatNotes';
// The three stops on the map: a cliff, a beach, a bay, pinned by their photos.
const STOPS = ['gok-om', 'gok-paradise', 'gok-halfmoon'].map((id) => places[id]).filter(Boolean);
// Where each pin sits on the map card, as fractions of its width and height.
const PIN_AT = [
  { x: 0.34, y: 0.3 },
  { x: 0.72, y: 0.52 },
  { x: 0.44, y: 0.76 },
];

export function FromThisToThis({ active, width, height }: { active: boolean; width: number; height: number }) {
  const reduced = useReducedMotion();
  const W = Math.min(width, 350);
  const H = height;
  const reelW = W * 0.47;
  const reelH = H * 0.74;
  const mapW = W * 0.5;
  const mapH = H * 0.66;
  const top = H * 0.16;

  // One slow breath shared by both cards, out of step so they don't move as one.
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(t);
      return;
    }
    t.set(withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [active, reduced, t]);
  const reelFloat = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * t.get() }] }));
  const mapFloat = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * (1 - t.get()) }] }));

  const route = routePath(PIN_AT.map((p) => ({ x: p.x * mapW, y: p.y * mapH })));

  return (
    <View
      style={{ width: W, height: H }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="From a travel reel to a map of Gokarna with three places pinned and a day planned."
    >
      {/* The handwritten notes, each with its arrow down to its card. */}
      <View style={[styles.note, { left: 4, top: 0 }]} pointerEvents="none">
        <Text style={[styles.noteText, { transform: [{ rotate: '-6deg' }] }]}>From this…</Text>
        <Svg width={26} height={30} style={{ marginLeft: -2, marginTop: -2 }}>
          <Path d="M20 2 C 6 6, 2 16, 7 27" stroke={NOTE_INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <Path d="M3 22 L 7 28 L 12 23" stroke={NOTE_INK} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={[styles.note, styles.noteRight, { right: 6, top: H * 0.02 }]} pointerEvents="none">
        <Text style={[styles.noteText, { transform: [{ rotate: '-5deg' }] }]}>…to this</Text>
        <Svg width={26} height={28} style={{ marginRight: 30, marginTop: -2 }}>
          <Path d="M22 2 C 12 4, 8 12, 8 25" stroke={NOTE_INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <Path d="M3 20 L 8 26 L 13 20" stroke={NOTE_INK} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>

      {/* The map, behind, turned towards the reel. */}
      <Animated.View
        style={[
          styles.card,
          styles.mapCard,
          { width: mapW, height: mapH, right: W * 0.02, top: top + H * 0.04 },
          { transform: [{ perspective: 700 }, { rotateY: '-20deg' }, { rotateZ: '4deg' }] },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, mapFloat]}>
          <MapArt w={mapW} h={mapH} route={route} />
          <View style={styles.place}>
            <Feather name="map-pin" size={10} color={INK} />
            <Text style={styles.placeText}>GOKARNA</Text>
          </View>
          {STOPS.map((p, i) => (
            <View key={p.id} style={[styles.pin, { left: PIN_AT[i].x * mapW - PIN / 2, top: PIN_AT[i].y * mapH - PIN / 2 }]}>
              <Image source={smallPhoto(p)} style={styles.pinPhoto} contentFit="cover" transition={0} />
              <View style={styles.pinNumber}>
                <Text style={styles.pinNumberText}>{i + 1}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </Animated.View>

      {/* The reel, in front, turned towards the map. */}
      {/* The float moves an outer layer, so it doesn't replace the card's own tilt. */}
      <Animated.View style={[styles.reelSlot, { width: reelW, height: reelH, left: W * 0.02, top }, reelFloat]}>
      <View
        style={[
          styles.card,
          styles.reelCard,
          StyleSheet.absoluteFill,
          { transform: [{ perspective: 700 }, { rotateY: '20deg' }, { rotateZ: '-5deg' }] },
        ]}
      >
        {STOPS[0] ? <Image source={STOPS[0].photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} /> : null}
        <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']} locations={[0, 0.25, 0.75, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.handle}>
          <Ionicons name="logo-instagram" size={13} color="#FFFFFF" />
          <Text style={styles.handleText}>@konkan.trails</Text>
        </View>
        <View style={styles.progress}>
          <View style={styles.progressDone} />
        </View>
      </View>
      </Animated.View>

      {/* What came of it, on a pill across both cards. */}
      <View style={[styles.result, { bottom: H * 0.02, right: W * 0.02 }]}>
        <View style={styles.resultTick}>
          <Feather name="check" size={11} color="#FFFFFF" />
        </View>
        <Text style={styles.resultStrong}>3 places found</Text>
        <Text style={styles.resultSoft}> · Day 1 planned</Text>
      </View>
    </View>
  );
}

const PIN = 34;

/** A painted bit of coast: sea to the west, land, a couple of roads, and the day's route. */
function MapArt({ w, h, route }: { w: number; h: number; route: string }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Path d={`M0 0 H${w} V${h} H0 Z`} fill="#EEF2E6" />
      <Path d={`M0 0 H${w * 0.2} C ${w * 0.3} ${h * 0.2}, ${w * 0.12} ${h * 0.4}, ${w * 0.22} ${h * 0.6} S ${w * 0.1} ${h * 0.9}, ${w * 0.16} ${h} H0 Z`} fill="#BFDDEB" />
      <Path d={`M${w * 0.55} 0 C ${w * 0.5} ${h * 0.3}, ${w * 0.8} ${h * 0.45}, ${w * 0.7} ${h}`} stroke="#FFFFFF" strokeWidth={5} fill="none" />
      <Path d={`M${w * 0.25} ${h * 0.55} C ${w * 0.5} ${h * 0.5}, ${w * 0.7} ${h * 0.7}, ${w} ${h * 0.62}`} stroke="#FFFFFF" strokeWidth={4} fill="none" />
      <Path d={`M${w * 0.62} ${h * 0.08} C ${w * 0.85} ${h * 0.12}, ${w * 0.9} ${h * 0.3}, ${w} ${h * 0.34}`} stroke="#DDE8D2" strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d={route} stroke={ROUTE} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** A soft curve through the stops. */
function routePath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    d += ` Q ${(a.x + b.x) / 2 + (b.y - a.y) * 0.2} ${(a.y + b.y) / 2 - (b.x - a.x) * 0.2}, ${b.x} ${b.y}`;
  }
  return d;
}

const styles = StyleSheet.create({
  note: { position: 'absolute', zIndex: 3 },
  noteRight: { alignItems: 'flex-end' },
  noteText: {
    fontFamily: NOTE_FONT,
    fontSize: 21,
    lineHeight: 24,
    color: NOTE_INK,
    // A soft dark halo keeps the handwriting clear on the brightest skies.
    textShadowColor: 'rgba(4,10,30,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  card: { position: 'absolute', borderRadius: 22, overflow: 'hidden', borderWidth: 3, borderColor: '#FFFFFF' },
  reelSlot: { position: 'absolute', zIndex: 2 },
  reelCard: { zIndex: 2, backgroundColor: '#1B2230', boxShadow: '0 22px 40px rgba(8,12,26,0.45), 0 4px 10px rgba(8,12,26,0.25)' },
  mapCard: { zIndex: 1, backgroundColor: '#EEF2E6', boxShadow: '0 18px 36px rgba(8,12,26,0.35)' },
  handle: { position: 'absolute', top: 12, left: 12, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  handleText: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: '#FFFFFF' },
  progress: { position: 'absolute', left: 12, right: 12, bottom: 12, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  progressDone: { width: '62%', height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  place: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 6px rgba(8,12,26,0.12)',
  },
  placeText: { fontFamily: fonts.sansSemi, fontSize: 9.5, letterSpacing: 1, color: INK },
  pin: { position: 'absolute', width: PIN, height: PIN },
  pinPhoto: { width: PIN, height: PIN, borderRadius: PIN / 2, borderWidth: 2.5, borderColor: ROUTE },
  pinNumber: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: INK,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinNumberText: { fontFamily: fonts.sansSemi, fontSize: 9, lineHeight: 11, color: '#FFFFFF' },
  result: {
    position: 'absolute',
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 12,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    boxShadow: '0 10px 24px rgba(8,12,26,0.3)',
    transform: [{ rotate: '-2deg' }],
  },
  resultTick: { width: 20, height: 20, borderRadius: 10, backgroundColor: ROUTE, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  resultStrong: { fontFamily: fonts.sansSemi, fontSize: 12.5, color: INK },
  resultSoft: { fontFamily: fonts.sans, fontSize: 12.5, color: '#4A5263' },
});
