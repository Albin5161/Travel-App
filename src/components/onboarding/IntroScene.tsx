import Feather from '@expo/vector-icons/Feather';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { CityMap, fitCameraToRect, useCamera, type Camera, type CameraValue, type MapPalette } from '@/components/CityMap';
import { Ticket } from '@/components/home/Ticket';
import { discRadius, EARTH_RADIUS, Globe, onGlobe } from '@/components/onboarding/Globe';
import { Text } from '@/components/Text';
import { cities, places, reels } from '@/data/catalog';
import { introMaps, type IntroMap } from '@/data/introMaps';
import type { Place } from '@/data/types';
import { formatClock, smoothPath, smoothPathStops, type Point } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { SPRING_DRAG } from '@/lib/motion';
import { useHomeSky } from '@/state/sky';
import { SKY, skyAccent, skyInk } from '@/theme/sky';
import { isLight } from '@/theme/mode';
import { fonts, light, radii, shadows, space } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
// A browser redraws a layer at its new size each time its scale changes, and the Earth grows to many
// times the screen: told this, it scales the picture it already has, as a phone does anyway.
const MOVES = Platform.OS === 'web' ? ({ willChange: 'transform, opacity' } as unknown as ViewStyle) : null;
const GUTTER = space.screen;

// The intro is one scene in four beats, and every part of it reads one number, `s`: 0 the thing
// you saved, 1 the Earth turned to where it is, 2 its places on the map, 3 the day they make.
// Between whole numbers each part is part-way between its two states, so nothing cuts, and going
// back plays the same moves in reverse.

/** The one saved thing the scene follows: a reel from Fort Kochi. */
export const PICK = {
  reelId: 'reel-kochi',
  /** In a sentence: "from that one reel". */
  noun: 'reel',
  /** Under "Found it." */
  where: 'Kochi, on the coast of Kerala.',
  at: { lat: 9.96, lng: 76.24 },
};

/** What the saved card says it is, in turn: any of them can be read. It comes to rest on the first. */
const KINDS = [
  { label: 'Reel', video: true },
  { label: 'YouTube video', video: true },
  { label: 'Instagram post', video: false },
];

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/**
 * The places in the order a day would take them: from the one furthest out, each time on to the
 * nearest one left. The video's own order zig-zags, and a route drawn through it crosses itself.
 */
function placesOf(reelId: string): Place[] {
  const left = (reels[reelId]?.placeIds ?? []).map((id) => places[id]).filter((p) => !!p);
  const gap = (a: Place, b: Place) => Math.hypot(a.map[0] - b.map[0], a.map[1] - b.map[1]);
  const cx = left.reduce((n, p) => n + p.map[0], 0) / Math.max(1, left.length);
  const cy = left.reduce((n, p) => n + p.map[1], 0) / Math.max(1, left.length);
  const far = (p: Place) => Math.hypot(p.map[0] - cx, p.map[1] - cy);
  const out: Place[] = [];
  let here = left.reduce<Place | null>((a, p) => (!a || far(p) > far(a) ? p : a), null);
  while (here) {
    const from = here;
    out.push(from);
    left.splice(left.indexOf(from), 1);
    here = left.reduce<Place | null>((a, p) => (!a || gap(p, from) < gap(a, from) ? p : a), null);
  }
  return out;
}

/** How long the move into each beat takes, in ms. The third is the zoom from the Earth to the street. */
export const INTRO_MS = [700, 1500, 2600, 1100];

/** Room kept for the words at the top of the first two beats and the foot of the last two. */
const HEAD_H = 96;
const FOOT_H = 112;
/** How much of the Earth shows at the foot of the first beat. */
const PEEK = 46;
const HORIZON = 2.6;
/** How far the land has still to turn when the Earth first shows, in degrees. */
const TURN = -46;
/** The room the last beat keeps under the map, on the sky, for the day's ticket and the words. */
const DAY_H = 236;
/**
 * How many times its resting size the Earth has grown when the drawn land takes over from it: about
 * when its picture would start to blur, with the coast still a few hundred kilometres across.
 */
const EARTH_UNTIL = 12;
/**
 * The map's own streets come in once the view has narrowed to about this much more than at rest:
 * by then the street map covers the card, so it never shows as a box on the land around it.
 */
const STREETS_FROM = 1.15;

type Props = {
  s: SharedValue<number>;
  /** The beat the scene is on or moving to. */
  step: number;
  width: number;
  height: number;
  /** The clear room between the top bar and the foot. */
  frame: { top: number; bottom: number };
};

export function IntroScene({ s, step, width: W, height: H, frame }: Props) {
  const streets = introMaps[PICK.reelId];
  const stops = useMemo(() => placesOf(PICK.reelId), []);
  const room = frame.bottom - frame.top;

  // The saved card on the first beat.
  const cardW = Math.round(Math.min(200, W * 0.5, (room - HEAD_H - PEEK - 40) / 1.62));
  const card = { w: cardW, h: Math.round(cardW * 1.62), x: (W - cardW) / 2, y: frame.top + HEAD_H + 8 };

  // The Earth at rest on the second beat.
  const D = Math.round(Math.max(180, Math.min(300, W - 96, room - HEAD_H - 40)));
  const globeAt = { x: W / 2, y: frame.top + HEAD_H + (room - HEAD_H) / 2 };
  // The map card of the last two beats.
  const map = { x: GUTTER, y: frame.top + 4, w: W - GUTTER * 2, h: room - FOOT_H - 4 };
  // On the last beat the map gives up its foot to the ticket, which sits on the sky under it.
  const dayH = Math.max(120, room - DAY_H - 4);

  // The map's camera, shared by the street map and the land around it.
  const points = useMemo(() => stops.map((p) => (streets?.places[p.id] ?? p.map) as Point), [stops, streets]);
  const view = { w: map.w, h: map.h };
  const open = useMemo(() => fitCameraToRect(points, view, { top: 20, bottom: 20 }, 120), [points, view.w, view.h]); // eslint-disable-line react-hooks/exhaustive-deps
  // On the last beat only the top of the map shows: the places move up into it.
  const under = useMemo(() => fitCameraToRect(points, view, { top: 12, bottom: map.h - dayH + 8 }, 90), [points, view.w, view.h, dayH]); // eslint-disable-line react-hooks/exhaustive-deps
  const camera = useCamera(open);

  // The whole zoom, from the Earth at rest to the street map at rest, as the natural log of how
  // much closer it comes: what one point of screen covers on the Earth, over what it covers on the
  // map. Everything that moves in it reads its size off this one figure, so each part is the same
  // size as the next where one hands over to the other.
  const M = streets?.m ?? 4;
  const zoomLog = Math.log((open.s * EARTH_RADIUS) / (discRadius(D) * M));
  const handOver = 1 + Math.log(EARTH_UNTIL) / zoomLog;
  const streetsIn = 2 - Math.log(STREETS_FROM) / zoomLog;

  useAnimatedReaction(
    () => s.get(),
    (t) => {
      const day = interpolate(t, [2.3, 2.9], [0, 1], Extrapolation.CLAMP);
      const far = Math.exp(zoomLog * Math.min(0, t - 2));
      camera.s.set((open.s + (under.s - open.s) * day) * far);
      camera.x.set(open.x + (under.x - open.x) * day);
      camera.y.set(open.y + (under.y - open.y) * day);
    },
  );

  const mark = onGlobe(PICK.at, D);
  // Where the dot on the Earth is on the map, and where on screen the map puts the middle of its
  // card, in the scene's own frame.
  const markAt = streets?.mark ?? points[0];
  const cardMid = { x: map.x + map.w / 2, y: map.y + map.h / 2 };

  // A finger can turn the Earth a little on the second beat; it swings back when let go.
  const drag = useSharedValue(0);
  const dragFrom = useSharedValue(0);
  const turn = Gesture.Pan()
    .enabled(step === 1)
    .activeOffsetX([-8, 8])
    .onStart(() => {
      dragFrom.set(drag.get());
    })
    .onUpdate((e) => {
      drag.set(dragFrom.get() + e.translationX * 0.22);
    })
    .onEnd(() => {
      drag.set(withSpring(0, SPRING_DRAG));
    });
  // The land comes up already turning and stops on the place: one picture the whole way.
  const landTurn = useDerivedValue(() => interpolate(s.get(), [0, 1], [TURN, 0], Extrapolation.CLAMP) + drag.get());
  // The Earth's close-up comes in over the first part of the zoom, from about 1.3 to 3 times its size.
  const detail = useDerivedValue(() => interpolate(s.get(), [1, 1 + Math.log(3) / zoomLog], [0, 1], Extrapolation.CLAMP));

  /**
   * Where the dot is on screen, through the zoom: still under the eye at first, then drifting to
   * where the street map will put it, so the Earth grows around it rather than out of its middle.
   */
  const dotAt = useDerivedValue(() => {
    const t = s.get();
    const z = interpolate(t, [1, 1.7], [0, 1], Extrapolation.CLAMP);
    const k = camera.s.get();
    const toX = cardMid.x + k * (markAt[0] - camera.x.get());
    const toY = cardMid.y + k * (markAt[1] - camera.y.get());
    return { x: globeAt.x + mark.x + (toX - (globeAt.x + mark.x)) * z, y: globeAt.y + mark.y + (toY - (globeAt.y + mark.y)) * z };
  });

  const globeStyle = useAnimatedStyle(() => {
    const t = s.get();
    // Up to rest it shrinks from the horizon; from rest it grows by the zoom's own measure.
    const scale = t <= 1 ? interpolate(t, [0, 1], [HORIZON, 1], Extrapolation.CLAMP) : Math.exp(zoomLog * Math.min(1, t - 1));
    // Rising from the foot of the screen to the middle of the room.
    const rise = interpolate(t, [0, 1], [frame.bottom + (HORIZON * D) / 2 - PEEK - globeAt.y, 0], Extrapolation.CLAMP);
    const at = dotAt.get();
    const zooming = t > 1 ? 1 : 0;
    return {
      opacity: interpolate(t, [handOver, handOver + 0.04], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: (at.x - globeAt.x - mark.x) * zooming - (scale - 1) * mark.x * zooming },
        { translateY: rise + (at.y - globeAt.y - mark.y) * zooming - (scale - 1) * mark.y * zooming },
        { scale },
      ],
    };
  });

  // The frame the Earth and the map share. It is the whole scene until the zoom starts, then closes
  // in to the map's card while the Earth is still growing inside it, so the Earth doesn't fade
  // into a card that appears beside it: it becomes the card. What's inside is held in place
  // against the frame's own move. On the last beat the frame draws up to leave room for the day.
  const windowStyle = useAnimatedStyle(() => {
    const t = s.get();
    const z = interpolate(t, [1.12, 1.7], [0, 1], Extrapolation.CLAMP);
    const day = interpolate(t, [2.3, 2.9], [0, 1], Extrapolation.CLAMP);
    return {
      left: map.x * z,
      top: map.y * z,
      width: W - (W - map.w) * z,
      height: H - (H - map.h) * z - (map.h - dayH) * day,
      // Square: the map is a window onto the place, not a card.
      // The glass cards' thin light rim, once it is a card.
      borderWidth: z > 0.5 ? StyleSheet.hairlineWidth : 0,
      opacity: interpolate(t, [3.15, 3.6], [1, 0], Extrapolation.CLAMP),
    };
  });
  const heldStyle = useAnimatedStyle(() => {
    const z = interpolate(s.get(), [1.12, 1.7], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateX: -map.x * z }, { translateY: -map.y * z }] };
  });

  const pulse = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    pulse.set(withRepeat(withTiming(1, { duration: 1400 }), -1, false));
  }, [pulse, reduced]);
  const markStyle = useAnimatedStyle(() => ({
    // Gone as the zoom gets going: it grows with the Earth, and a dot the size of a coin looks wrong.
    opacity: interpolate(s.get(), [0.86, 1, 1.01, 1 + Math.log(1.8) / zoomLog], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: D / 2 + mark.x - 20 }, { translateY: D / 2 + mark.y - 20 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - pulse.get()),
    transform: [{ scale: 0.5 + pulse.get() * 0.9 }],
  }));

  // The maps are drawn from the start, unseen, while the opening animation still covers the screen:
  // drawing them is the one heavy job in the scene, and done as a move starts it would make that
  // move stutter. They go once the name step is up.
  const showing = step <= 3;
  const [mapOn, setMapOn] = useState(showing);
  if (showing && !mapOn) setMapOn(true);
  useEffect(() => {
    if (showing) return;
    const t = setTimeout(() => setMapOn(false), 700);
    return () => clearTimeout(t);
  }, [showing]);

  // Never quite nothing, so each is already painted when its turn comes; but far too faint to see,
  // even as pale paper on a night sky.
  const landStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.get(), [handOver - 0.02, handOver + 0.02], [0.004, 1], Extrapolation.CLAMP),
  }));
  const mapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.get(), [streetsIn - 0.06, streetsIn], [0.004, 1], Extrapolation.CLAMP),
  }));

  const dark = useDarkMap();
  // On the sky the maps are drawn dark, from the sky; in the light look they are paper.
  const palette = isLight ? light : dark;

  const n = stops.length;
  const many = n > 5;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.window, windowStyle]}>
        <Animated.View style={[styles.held, { width: W, height: H }, heldStyle]}>
          {mapOn && streets ? (
            <Animated.View style={[StyleSheet.absoluteFill, landStyle]} pointerEvents="none">
              <ZoomLand
                map={streets}
                palette={palette}
                s={s}
                camera={camera}
                dotAt={dotAt}
                handOver={handOver}
                straight={1.7}
                width={W}
                height={H}
              />
            </Animated.View>
          ) : null}
          {mapOn ? (
            <Animated.View style={[styles.map, { left: map.x, top: map.y, width: map.w, height: map.h }, mapStyle]}>
              <MapStage
                stops={stops}
                points={points}
                streets={streets}
                camera={camera}
                open={open}
                under={under}
                palette={palette}
                s={s}
                step={step}
                width={map.w}
                height={map.h}
              />
            </Animated.View>
          ) : null}
          <GestureDetector gesture={turn}>
            <Animated.View style={[styles.globe, MOVES, { left: globeAt.x - D / 2, top: globeAt.y - D / 2, width: D, height: D }, globeStyle]}>
              <Globe size={D} turn={landTurn} detail={detail}>
                <Animated.View style={[styles.mark, markStyle]} pointerEvents="none">
                  <Animated.View style={[styles.ring, ringStyle]} />
                  <View style={styles.dot} />
                </Animated.View>
              </Globe>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </Animated.View>

      <SavedCard s={s} step={step} card={card} dot={{ x: globeAt.x + mark.x, y: globeAt.y + mark.y }} />

      {mapOn ? (
        <DayTicket s={s} stops={stops} city={cities[reels[PICK.reelId].cityId]} left={map.x} width={map.w} top={map.y + dayH + 20} />
      ) : null}

      <Words s={s} at={0} top={frame.top} title="You saved this." body="A reel, a YouTube video or an Instagram post. Where is it, though?" />
      <Words s={s} at={1} top={frame.top} title="Found it." body={PICK.where} />
      <Words
        s={s}
        at={2}
        bottom={H - frame.bottom + 6}
        title={`${WORDS[n] ?? n} ${n === 1 ? 'place' : 'places'} from that one ${PICK.noun}.`}
        body="Each one checked against the map."
      />
      <Words s={s} at={3} bottom={H - frame.bottom + 6} title={many ? 'A weekend, planned.' : 'A day, planned.'} />
    </View>
  );
}

/**
 * The saved thing. On the first beat its label runs through what Xplore can read (a reel, a
 * YouTube video, an Instagram post) and comes to rest on the reel; then it flies to its place on
 * the Earth and shrinks onto it.
 */
function SavedCard({
  s,
  step,
  card,
  dot,
}: {
  s: SharedValue<number>;
  step: number;
  card: { x: number; y: number; w: number; h: number };
  dot: { x: number; y: number };
}) {
  const reel = reels[PICK.reelId];
  const [kind, setKind] = useState(0);
  useEffect(() => {
    if (step !== 0) return;
    // Round once through the three, then back to the reel, which it is.
    let i = 0;
    const tick = setInterval(() => {
      i += 1;
      setKind(i % KINDS.length);
      if (i >= KINDS.length) clearInterval(tick);
    }, 450);
    return () => clearInterval(tick);
  }, [step]);
  const k = KINDS[step === 0 ? kind : 0];

  // It lands the size of the dot.
  const small = 14 / card.w;
  const style = useAnimatedStyle(() => {
    const go = interpolate(s.get(), [0, 1], [0, 1], Extrapolation.CLAMP);
    return {
      // Gone as it touches down, and the dot is there in its place.
      opacity: interpolate(s.get(), [0.86, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: (dot.x - (card.x + card.w / 2)) * go },
        { translateY: (dot.y - (card.y + card.h / 2)) * go },
        { scale: 1 + (small - 1) * go },
        { rotate: `${-4 - 2 * go}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.card, { left: card.x, top: card.y, width: card.w, height: card.h }, style]}
      pointerEvents="none"
      accessible
      accessibilityLabel={`A saved reel: ${reel.title}`}
    >
      <View style={styles.cardFace}>
        <Image source={reel.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        <LinearGradient colors={['rgba(8,14,30,0)', 'rgba(8,14,30,0.78)']} style={styles.cardShade} pointerEvents="none" />
        {k.video ? (
          <View style={styles.play}>
            <Feather name="play" size={16} color="#FFFFFF" />
          </View>
        ) : (
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.pageDot, i === 0 && styles.pageDotOn]} />
            ))}
          </View>
        )}
        <View style={[styles.kind, styles.bottomLeft]}>
          <Text variant="micro" color="#FFFFFF" style={styles.kindText} numberOfLines={1}>
            {k.label}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * The land around the place, drawn (Natural Earth): what the zoom passes through between the Earth
 * and the street map. It is the same land the Earth shows, at the same size where it takes over,
 * and the same as the street map's where that takes over, because all three read their size off
 * the map's one camera. Drawn as shapes, not a picture, so it stays sharp at every size on the way.
 */
function ZoomLand({
  map,
  palette,
  s,
  camera,
  dotAt,
  handOver,
  straight,
  width,
  height,
}: {
  map: IntroMap;
  palette: MapPalette;
  s: SharedValue<number>;
  camera: Camera;
  dotAt: SharedValue<{ x: number; y: number }>;
  handOver: number;
  /** By here it is turned from the Earth's way to the street map's. */
  straight: number;
  width: number;
  height: number;
}) {
  const [a, b, c, d] = map.toEarth;
  const [mx, my] = map.mark;
  const placed = useAnimatedProps((): { transform?: string; matrix?: number[] } => {
    const k = camera.s.get();
    // Turned the Earth's way where the Earth hands over to it, and eased into the map's on the way in.
    const w = interpolate(s.get(), [handOver, straight], [0, 1], Extrapolation.CLAMP);
    const ka = k * (a + (1 - a) * w);
    const kb = k * b * (1 - w);
    const kc = k * c * (1 - w);
    const kd = k * (d + (1 - d) * w);
    const at = dotAt.get();
    // The dot's spot stays on the dot: x' = at + K (u - mark).
    const e = at.x - (ka * mx + kb * my);
    const f = at.y - (kc * mx + kd * my);
    return Platform.OS === 'web' ? { transform: `matrix(${ka} ${kc} ${kb} ${kd} ${e} ${f})` } : { matrix: [ka, kc, kb, kd, e, f] };
  });
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={palette.mapSea} />
      <AnimatedG animatedProps={placed}>
        {/* Each path is written in coarser units than the map's, to keep it short. */}
        <G scale={map.regionStep}>
          <Path d={map.region} fill={palette.mapLand} />
        </G>
        <G scale={map.nearStep}>
          <Path d={map.near} fill={palette.mapLand} />
          <Path d={map.nearWater} fill={palette.mapSea} fillRule="evenodd" />
        </G>
      </AnimatedG>
    </Svg>
  );
}

/** One colour part-way to another, both #RRGGBB. */
function mix(a: string, b: string, t: number) {
  const at = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(at(a, i) + (at(b, i) - at(a, i)) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The intro's map in the dark, made from the sky it sits on: the sea a deeper note of that sky, the
 * land a lighter one, everything else in white. Pale paper on the sky stood out like a lit window;
 * this reads as part of it, at any hour. The land stays the lighter of the two, as it is on the
 * Earth it grows out of.
 */
function useDarkMap(): MapPalette {
  const sky = SKY[useHomeSky()].stops[1];
  return useMemo(
    () => ({
      mapSea: mix(sky, '#000000', 0.45),
      mapLand: mix(sky, '#FFFFFF', 0.1),
      mapCoast: 'rgba(255,255,255,0.24)',
      mapRoad: 'rgba(255,255,255,0.2)',
      mapTrail: 'rgba(255,255,255,0.46)',
      mapLabel: 'rgba(255,255,255,0.9)',
      mapSeaLabel: 'rgba(255,255,255,0.62)',
      line: 'rgba(255,255,255,0.1)',
    }),
    [sky],
  );
}

/** The first place lands as the map comes to rest; the rest follow at this gap, in ms. */
const DROP_AFTER = 2250;
const DROP_GAP = 140;

/**
 * The map of the place: its real streets, coast and water (OpenStreetMap, drawn by us), in the dark.
 * It comes in at the end of the zoom, at the size the land around it has reached, and settles; then
 * its places land one at a time as small dots, and on the last beat a line joins them in order
 * while the map draws up to leave room for the day.
 */
function MapStage({
  stops,
  points,
  streets,
  camera,
  open,
  under,
  palette,
  s,
  step,
  width,
  height,
}: {
  stops: Place[];
  points: Point[];
  streets: IntroMap | undefined;
  camera: Camera;
  open: CameraValue;
  under: CameraValue;
  palette: MapPalette;
  s: SharedValue<number>;
  step: number;
  width: number;
  height: number;
}) {
  const city = cities[reels[PICK.reelId].cityId];

  // The places land once the map is the thing on screen, each with a tap you can feel.
  const landed = step >= 2;
  useEffect(() => {
    if (!landed) return;
    const timers = stops.map((_, i) => setTimeout(() => haptic.light(), DROP_AFTER + i * DROP_GAP + 180));
    return () => timers.forEach(clearTimeout);
  }, [landed, stops]);

  const d = useMemo(() => smoothPath(points), [points]);
  const length = useMemo(() => {
    const at = smoothPathStops(points);
    return at[at.length - 1] ?? 0;
  }, [points]);
  const drawn = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - interpolate(s.get(), [2.1, 2.75], [0, 1], Extrapolation.CLAMP)),
  }));

  if (!city) return null;
  const ink = isLight ? light.ink : '#FFFFFF';
  return (
    <>
    <CityMap
      city={city}
      world={streets?.world}
      layers={streets ? <Streets map={streets} palette={palette} ink={ink} scale={open.s} /> : undefined}
      dots={streets ? { fill: ink, ink: isLight ? '#FFFFFF' : mix(SKY.night.stops[1], '#000000', 0.3) } : undefined}
      pins={landed ? stops.map((p, i) => ({ id: p.id, place: p, point: points[i], number: step >= 3 ? i + 1 : undefined })) : []}
      width={width}
      height={height}
      camera={camera}
      maxScale={Math.max(open.s, under.s) * 1.1}
      reveal
      revealDelay={DROP_AFTER}
      revealStagger={DROP_GAP}
      interactive={false}
      pinSize={streets ? 28 : 40}
      palette={palette}
      artChildren={
        points.length > 1 ? (
          <AnimatedPath
            d={d}
            fill="none"
            stroke={ink}
            strokeWidth={2 / open.s}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[length, length]}
            animatedProps={drawn}
          />
        ) : null
      }
    />
    {streets ? (
      <Text variant="micro" style={[styles.credit, { color: isLight ? light.inkSoft : skyInk.faint }]}>
        © OpenStreetMap
      </Text>
    ) : null}
    </>
  );
}

/**
 * A place's streets, as a map app draws them at night: hairlines, brighter for the bigger roads,
 * the water a shade deeper than the land with a fine edge. Widths are in screen points at the map's
 * resting scale (`scale`), so they come out the same on every map whatever its units.
 */
function Streets({ map, palette, ink, scale }: { map: IntroMap; palette: MapPalette; ink: string; scale: number }) {
  const pt = (n: number) => n / scale;
  const line = { fill: 'none', stroke: ink, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <>
      {map.water ? <Path d={map.water} fill={palette.mapSea} fillRule="evenodd" stroke={ink} strokeOpacity={0.22} strokeWidth={pt(0.7)} /> : null}
      {map.rivers ? <Path d={map.rivers} {...line} stroke={palette.mapSea} strokeWidth={pt(1.6)} /> : null}
      {map.streams ? <Path d={map.streams} {...line} stroke={palette.mapSea} strokeWidth={pt(1)} /> : null}
      {map.small ? <Path d={map.small} {...line} strokeOpacity={0.14} strokeWidth={pt(0.5)} /> : null}
      {map.minor ? <Path d={map.minor} {...line} strokeOpacity={0.3} strokeWidth={pt(0.7)} /> : null}
      {map.major ? <Path d={map.major} {...line} strokeOpacity={0.62} strokeWidth={pt(1.4)} /> : null}
      {map.labels.map((l) => (
        <SvgText
          key={l.text}
          x={l.x}
          y={l.y}
          fill={ink}
          fillOpacity={0.62}
          fontFamily={fonts.sansSemi}
          fontSize={pt(9)}
          letterSpacing={pt(1.6)}
          textAnchor="middle"
        >
          {l.text}
        </SvgText>
      ))}
    </>
  );
}

/**
 * The day the places make, as the ticket Home shows a trip on: the place's photo, the day in order,
 * and the number of stops on the stub past the tear. It comes up on the sky under the map.
 */
function DayTicket({ s, stops, city, left, width, top }: { s: SharedValue<number>; stops: Place[]; city: { name: string; hero: ImageProps['source'] } | undefined; left: number; width: number; top: number }) {
  const style = useAnimatedStyle(() => {
    const t = s.get();
    return {
      opacity: interpolate(t, [2.5, 2.95, 3.1, 3.5], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(t, [2.5, 3], [32, 0], Extrapolation.CLAMP) }],
    };
  });
  if (!city) return null;
  const shown = stops.slice(0, 4);
  const more = stops.length - shown.length;
  return (
    <Animated.View style={[styles.ticket, { left, width, top }, style]} pointerEvents="none">
      <Ticket
        photo={city.hero}
        onPress={() => {}}
        accessibilityLabel={`${city.name}, a day of ${stops.length} stops: ${shown.map((p) => p.name).join(', ')}`}
        stub={
          <View style={styles.stubCount}>
            <Text style={styles.stubNumber}>{stops.length}</Text>
            <Text variant="micro" color={light.inkSoft}>
              {stops.length === 1 ? 'stop' : 'stops'}
            </Text>
          </View>
        }
      >
        <Text variant="title" numberOfLines={1}>
          {city.name}
        </Text>
        <View style={styles.rows}>
          {shown.map((p, i) => (
            <View key={p.id} style={styles.row}>
              <Text variant="data" color={light.inkSoft} style={styles.time}>
                {formatClock(540 + i * 120)}
              </Text>
              <Text variant="label" numberOfLines={1} style={styles.rowName}>
                {p.name}
              </Text>
            </View>
          ))}
          {more > 0 ? (
            <Text variant="label" color={light.inkSoft}>
              and {WORDS[more]?.toLowerCase() ?? more} more
            </Text>
          ) : null}
        </View>
      </Ticket>
    </Animated.View>
  );
}

/** A beat's words: there while the scene is on that beat, gone by half-way to the next. */
function Words({ s, at, top, bottom, title, body }: { s: SharedValue<number>; at: number; top?: number; bottom?: number; title: string; body?: string }) {
  const style = useAnimatedStyle(() => {
    const d = s.get() - at;
    return {
      // In over the back half of the move; out in its first fifth, before anything grows over them.
      opacity: interpolate(d, [-0.42, 0, 0.2], [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(d, [-0.5, 0, 0.5], [10, 0, -10], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[styles.words, top !== undefined ? { top } : { bottom }, style]} pointerEvents="none">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text variant="body">{body}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  globe: { position: 'absolute' },
  mark: { position: 'absolute', left: 0, top: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: skyAccent },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: skyAccent, borderWidth: 2, borderColor: '#FFFFFF' },
  card: { position: 'absolute' },
  cardFace: { flex: 1, borderRadius: radii.thumb, overflow: 'hidden', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.95)', boxShadow: shadows.card },
  cardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  // A dark chip, so the label reads over any photo in any corner.
  kind: { position: 'absolute', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(14,16,20,0.66)' },
  kindText: { fontFamily: fonts.sansSemi },
  bottomLeft: { left: 7, bottom: 7 },
  play: {
    position: 'absolute',
    left: '50%',
    top: '42%',
    width: 34,
    height: 34,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 17,
    paddingLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,16,20,0.55)',
  },
  dots: { position: 'absolute', right: 10, top: 11, flexDirection: 'row', gap: 4 },
  pageDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  pageDotOn: { backgroundColor: '#FFFFFF' },
  window: { position: 'absolute', overflow: 'hidden', borderColor: skyInk.rim },
  held: { position: 'absolute', left: 0, top: 0 },
  map: { position: 'absolute' },
  ticket: { position: 'absolute' },
  stubCount: { alignItems: 'center' },
  stubNumber: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: light.ink, fontVariant: ['tabular-nums'] },
  rows: { marginTop: 8, gap: 4 },
  row: { flexDirection: 'row', gap: 8 },
  time: { width: 64 },
  rowName: { flex: 1 },
  words: { position: 'absolute', left: GUTTER, right: GUTTER, gap: 8 },
  credit: { position: 'absolute', top: 8, right: 12, fontSize: 9 },
  // The page title's size, as on every screen.
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1.1, color: skyInk.strong },
});
