import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
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
import { Path } from 'react-native-svg';

import { CityMap, fitCameraToRect, useCamera, type MapPalette } from '@/components/CityMap';
import { Globe, onGlobe } from '@/components/onboarding/Globe';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { cities, places, reels } from '@/data/catalog';
import type { Place } from '@/data/types';
import { formatClock, smoothPath, smoothPathStops, type Point } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { SPRING_DRAG, SPRING_SETTLE } from '@/lib/motion';
import { useHomeSky } from '@/state/sky';
import { SKY, skyAccent, skyCta, skyInk } from '@/theme/sky';
import { fonts, light, radii, shadows, space } from '@/theme/tokens';
import { Tone } from '@/theme/tone';

const AnimatedPath = Animated.createAnimatedComponent(Path);
// A browser redraws a layer at its new size each time its scale changes, and the Earth grows to many
// times the screen: told this, it scales the picture it already has, as a phone does anyway.
const MOVES = Platform.OS === 'web' ? ({ willChange: 'transform, opacity' } as unknown as ViewStyle) : null;
const GUTTER = space.screen;

// The intro is one scene in four beats, and every part of it reads one number, `s`: 0 the things
// you saved, 1 the Earth turned to where one of them is, 2 its places on the map, 3 the day they
// make. Between whole numbers each part is part-way between its two states, so nothing cuts, and
// going back plays the same moves in reverse.

export type PickId = 'reel' | 'video' | 'post';

type Pick = {
  id: PickId;
  /** On the card. */
  label: string;
  /** In a sentence: "from that one reel". */
  noun: string;
  reelId: string;
  /** Under "Found it." */
  where: string;
  at: { lat: number; lng: number };
  /** The card on the first beat, in the units of a 264-wide stage. */
  card: { x: number; y: number; w: number; h: number; turn: number };
  /** Which corner the label sits in: the one its neighbours leave uncovered. */
  corner: 'bottomLeft' | 'topRight' | 'bottomRight';
};

// The three things Xplore reads, each one of the bundled samples, each somewhere else on the Earth.
export const PICKS: Pick[] = [
  {
    id: 'video',
    label: 'YouTube video',
    noun: 'video',
    reelId: 'reel-gokarna',
    where: 'Gokarna, on the Karnataka coast.',
    at: { lat: 14.54, lng: 74.32 },
    card: { x: 96, y: 0, w: 160, h: 94, turn: 4 },
    corner: 'topRight',
  },
  {
    id: 'post',
    label: 'Post',
    noun: 'post',
    reelId: 'reel-meghalaya',
    where: 'Meghalaya, in the hills of the north-east.',
    at: { lat: 25.3, lng: 91.7 },
    card: { x: 142, y: 126, w: 114, h: 114, turn: -3 },
    corner: 'bottomRight',
  },
  {
    id: 'reel',
    label: 'Reel',
    noun: 'reel',
    reelId: 'reel-kochi',
    where: 'Kochi, on the coast of Kerala.',
    at: { lat: 9.96, lng: 76.24 },
    card: { x: 8, y: 68, w: 118, h: 202, turn: -5 },
    corner: 'bottomLeft',
  },
];
const STAGE = { w: 264, h: 270 };

/**
 * The whole zoom, from the Earth at rest to the map at rest, as the natural log of how much bigger
 * things get. The Earth and the map both read their size off this one figure, so at the moment one
 * hands over to the other they are growing at exactly the same rate: that is what stops it
 * reading as a cut.
 */
const ZOOM_LOG = 4.2;
const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const pickOf = (id: PickId) => PICKS.find((p) => p.id === id) ?? PICKS[2];
/**
 * The pick's places in the order a day would take them: from the one furthest out, each time on to
 * the nearest one left. The video's own order zig-zags, and a route drawn through it crosses itself.
 */
function placesOf(pick: Pick): Place[] {
  const left = (reels[pick.reelId]?.placeIds ?? []).map((id) => places[id]).filter((p) => !!p);
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

/** What the button under each beat says. */
export const INTRO_CTA = ['See where this is', 'Take me there', 'Make it a day', 'That’s the idea'];
/** How long the move into each beat takes, in ms. */
export const INTRO_MS = [700, 1500, 1900, 1100];

/** Room kept for the words at the top of the first two beats and the foot of the last two. */
const HEAD_H = 88;
const FOOT_H = 104;
/** How much of the Earth shows over the button on the first beat. */
const PEEK = 46;
const HORIZON = 2.6;
/** How far the land has still to turn when the Earth first shows, in degrees. */
const TURN = -46;
/** The room the last beat keeps under the map, on the sky, for the day's ticket and the words. */
const DAY_H = 214;

type Props = {
  s: SharedValue<number>;
  /** The beat the scene is on or moving to. */
  step: number;
  pick: PickId;
  onPick: (id: PickId) => void;
  width: number;
  height: number;
  /** The clear room between the top bar and the button. */
  frame: { top: number; bottom: number };
};

export function IntroScene({ s, step, pick: pickId, onPick, width: W, height: H, frame }: Props) {
  const pick = pickOf(pickId);
  const stops = useMemo(() => placesOf(pick), [pick]);
  const room = frame.bottom - frame.top;

  // The first beat's cards, scaled to the room there is.
  const k = Math.max(0.7, Math.min(1.3, (W - GUTTER * 2) / STAGE.w, (room - HEAD_H - PEEK - 24) / STAGE.h));
  const stage = { x: (W - STAGE.w * k) / 2, y: frame.top + HEAD_H };

  // The Earth at rest on the second beat.
  const D = Math.round(Math.max(180, Math.min(300, W - 96, room - HEAD_H - 40)));
  const globeAt = { x: W / 2, y: frame.top + HEAD_H + (room - HEAD_H) / 2 };
  // The map card of the last two beats.
  const map = { x: GUTTER, y: frame.top + 4, w: W - GUTTER * 2, h: room - FOOT_H - 4 };
  // On the last beat the map gives up its foot to the ticket, which sits on the sky under it.
  const dayH = Math.max(120, room - DAY_H - 4);

  const mark = onGlobe(pick.at, D);
  const mx = useSharedValue(mark.x);
  const my = useSharedValue(mark.y);
  useEffect(() => {
    mx.set(mark.x);
    my.set(mark.y);
  }, [mark.x, mark.y, mx, my]);

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

  const globeStyle = useAnimatedStyle(() => {
    const t = s.get();
    // Up to rest it shrinks from the horizon; from rest it grows by the zoom's own measure.
    const scale = t <= 1 ? interpolate(t, [0, 1], [HORIZON, 1], Extrapolation.CLAMP) : Math.exp(ZOOM_LOG * Math.min(1, t - 1));
    // Rising from under the button to the middle of the room.
    const rise = interpolate(t, [0, 1], [frame.bottom + (HORIZON * D) / 2 - PEEK - globeAt.y, 0], Extrapolation.CLAMP);
    // Zooming: the marked place holds still under the eye and drifts to where the map will be,
    // so the Earth grows around it rather than out of its own middle.
    const z = interpolate(t, [1, 1.7], [0, 1], Extrapolation.CLAMP);
    const toX = (map.x + map.w / 2 - (globeAt.x + mx.get())) * z;
    const toY = (map.y + map.h / 2 - (globeAt.y + my.get())) * z;
    return {
      opacity: interpolate(t, [HAND_OVER, HAND_OVER + 0.14], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: toX - (scale - 1) * mx.get() * (t > 1 ? 1 : 0) },
        { translateY: rise + toY - (scale - 1) * my.get() * (t > 1 ? 1 : 0) },
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
      // Never quite square: going from no rounding to some makes a browser rebuild the frame mid-zoom.
      borderRadius: 0.5 + radii.card * z,
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
    opacity: interpolate(s.get(), [0.86, 1, 1.45, 1.7], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: D / 2 + mx.get() - 20 }, { translateY: D / 2 + my.get() - 20 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - pulse.get()),
    transform: [{ scale: 0.5 + pulse.get() * 0.9 }],
  }));

  // The map is drawn a beat early, unseen, while the Earth sits still: drawing it is the one heavy
  // job in the scene, and done as the zoom starts it would make the zoom stutter. It lingers a
  // moment on the way back.
  const showing = step >= 1 && step <= 3;
  const [mapOn, setMapOn] = useState(showing);
  if (showing && !mapOn) setMapOn(true);
  useEffect(() => {
    if (showing) return;
    const t = setTimeout(() => setMapOn(false), 700);
    return () => clearTimeout(t);
  }, [showing]);

  const mapStyle = useAnimatedStyle(() => ({
    // Never quite nothing, so it is already painted when the Earth hands over to it; but far too
    // faint to see, even as pale paper on a night sky.
    opacity: interpolate(s.get(), [HAND_OVER - 0.02, HAND_OVER + 0.1], [0.004, 1], Extrapolation.CLAMP),
  }));

  const n = stops.length;
  const many = n > 5;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.window, windowStyle]}>
        <Animated.View style={[styles.held, { width: W, height: H }, heldStyle]}>
          {mapOn ? (
            <Animated.View style={[styles.map, { left: map.x, top: map.y, width: map.w, height: map.h }, mapStyle]}>
              <MapStage key={pick.id} pick={pick} stops={stops} s={s} step={step} width={map.w} height={map.h} dayHeight={dayH} />
            </Animated.View>
          ) : null}
          <GestureDetector gesture={turn}>
            <Animated.View style={[styles.globe, MOVES, { left: globeAt.x - D / 2, top: globeAt.y - D / 2, width: D, height: D }, globeStyle]}>
              <Globe size={D} turn={landTurn}>
                <Animated.View style={[styles.mark, markStyle]} pointerEvents="none">
                  <Animated.View style={[styles.ring, ringStyle]} />
                  <View style={styles.dot} />
                </Animated.View>
              </Globe>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </Animated.View>

      {PICKS.map((p) => (
        <PickCard
          key={p.id}
          pick={p}
          picked={p.id === pick.id}
          s={s}
          k={k}
          stage={stage}
          // Where the picked one lands: on its own spot on the Earth, where the dot then shows.
          dot={{ x: globeAt.x + mark.x, y: globeAt.y + mark.y }}
          enabled={step === 0}
          onPress={() => {
            haptic.selection();
            onPick(p.id);
          }}
        />
      ))}

      {mapOn ? (
        <DayTicket s={s} stops={stops} name={cities[reels[pick.reelId].cityId]?.name ?? ''} left={map.x} width={map.w} top={map.y + dayH + 12} />
      ) : null}

      <Words s={s} at={0} top={frame.top} title="You saved these." body="Pick one. Where is it, though?" />
      <Words s={s} at={1} top={frame.top} title="Found it." body={pick.where} />
      <Words
        s={s}
        at={2}
        bottom={H - frame.bottom + 6}
        title={`${WORDS[n] ?? n} ${n === 1 ? 'place' : 'places'} from that one ${pick.noun}.`}
        body="Each one checked against the map."
      />
      <Words s={s} at={3} bottom={H - frame.bottom + 6} title={many ? 'A weekend, planned.' : 'A day, planned.'} />
    </View>
  );
}

/** One of the three saved things. Picked, it lifts; then it flies to its place on the Earth and shrinks onto it, while the others drop away. */
function PickCard({
  pick,
  picked,
  s,
  k,
  stage,
  dot,
  enabled,
  onPress,
}: {
  pick: Pick;
  picked: boolean;
  s: SharedValue<number>;
  k: number;
  stage: { x: number; y: number };
  dot: { x: number; y: number };
  enabled: boolean;
  onPress: () => void;
}) {
  const reel = reels[pick.reelId];
  const c = pick.card;
  const w = c.w * k;
  const h = c.h * k;
  const left = stage.x + c.x * k;
  const top = stage.y + c.y * k;
  const on = useSharedValue(picked ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(picked ? 1 : 0, SPRING_SETTLE));
  }, [on, picked]);
  // It lands the size of the dot, whatever the card was.
  const small = 14 / w;
  const style = useAnimatedStyle(() => {
    const t = s.get();
    const a = on.get();
    const go = interpolate(t, [0, 1], [0, 1], Extrapolation.CLAMP);
    // Not the picked one: down and out as the Earth comes up.
    const away = interpolate(t, [0, 0.45], [0, 1], Extrapolation.CLAMP) * (1 - a);
    return {
      // The picked one is gone as it touches down, and the dot is there in its place.
      opacity: (1 - away) * interpolate(t, [0.86, 1], [1, 0], Extrapolation.CLAMP),
      zIndex: a > 0.5 ? 2 : 1,
      transform: [
        { translateX: (dot.x - (left + w / 2)) * go * a },
        { translateY: (dot.y - (top + h / 2)) * go * a + away * 70 },
        { scale: (1 + 0.06 * a) * (1 + (small - 1) * go * a) },
        { rotate: `${c.turn + (-6 - c.turn) * go * a}deg` },
      ],
    };
  });
  const tick = useAnimatedStyle(() => ({
    opacity: on.get() * interpolate(s.get(), [0, 0.3], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: 0.6 + 0.4 * on.get() }],
  }));
  const ring = useAnimatedStyle(() => ({ opacity: on.get() }));
  const video = pick.id !== 'post';
  return (
    <Animated.View style={[styles.card, { left, top, width: w, height: h }, style]} pointerEvents={enabled ? 'auto' : 'none'}>
      <PressableScale
        onPress={onPress}
        containerStyle={styles.fill}
        style={styles.fill}
        accessibilityRole="radio"
        accessibilityState={{ selected: picked }}
        accessibilityLabel={`${pick.label}: ${reel.title}`}
      >
        <Animated.View style={[styles.cardRing, { borderRadius: radii.thumb + 5 }, ring]} />
        <View style={styles.cardFace}>
          <Image source={reel.thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          <LinearGradient colors={['rgba(8,14,30,0)', 'rgba(8,14,30,0.78)']} style={styles.cardShade} pointerEvents="none" />
          {video ? (
            <View style={styles.play}>
              <Feather name="play" size={14} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.dots}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.pageDot, i === 0 && styles.pageDotOn]} />
              ))}
            </View>
          )}
          <View style={[styles.kind, styles[pick.corner]]}>
            <Text variant="micro" color="#FFFFFF" style={styles.kindText} numberOfLines={1}>
              {pick.label}
            </Text>
          </View>
        </View>
      </PressableScale>
      <Animated.View style={[styles.tick, tick]} pointerEvents="none">
        <Feather name="check" size={14} color="#FFFFFF" />
      </Animated.View>
    </Animated.View>
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

/** Where on the way from the Earth (1) to the map (2) the one gives way to the other: late, with the land filling the frame. */
const HAND_OVER = 1.8;
/** The first place lands as the map comes to rest; the rest follow at this gap, in ms. */
const DROP_AFTER = 1550;
const DROP_GAP = 140;

/**
 * The map of where the pick is: the app's own drawn map, in the dark. It arrives still coming closer, at
 * the rate the Earth was growing, and settles; then its places land one at a time, and on the last
 * beat a line joins them in order while the map draws up to leave room for the day.
 */
function MapStage({
  pick,
  stops,
  s,
  step,
  width,
  height,
  dayHeight,
}: {
  pick: Pick;
  stops: Place[];
  s: SharedValue<number>;
  step: number;
  width: number;
  height: number;
  /** How much of the map still shows on the last beat. */
  dayHeight: number;
}) {
  const city = cities[reels[pick.reelId].cityId];
  const palette = useDarkMap();
  const points = useMemo(() => stops.map((p) => p.map as Point), [stops]);
  const view = { w: width, h: height };
  const open = useMemo(() => fitCameraToRect(points, view, { top: 20, bottom: 20 }, 120), [points, view.w, view.h]); // eslint-disable-line react-hooks/exhaustive-deps
  // On the last beat only the top of the map shows: the places move up into it.
  const under = useMemo(() => fitCameraToRect(points, view, { top: 12, bottom: height - dayHeight + 8 }, 90), [points, view.w, view.h, dayHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // The camera reads the scene's one value, like everything else: how close it is comes off the
  // same zoom figure the Earth grows by, so the two are moving at one speed where they meet.
  const camera = useCamera(open);
  useAnimatedReaction(
    () => s.get(),
    (t) => {
      const day = interpolate(t, [2.3, 2.9], [0, 1], Extrapolation.CLAMP);
      const far = Math.exp(ZOOM_LOG * Math.min(0, t - 2));
      camera.s.set((open.s + (under.s - open.s) * day) * far);
      camera.x.set(open.x + (under.x - open.x) * day);
      camera.y.set(open.y + (under.y - open.y) * day);
    },
  );

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
  return (
    <CityMap
      city={city}
      pins={landed ? stops.map((p, i) => ({ id: p.id, place: p, number: step >= 3 ? i + 1 : undefined })) : []}
      width={width}
      height={height}
      camera={camera}
      maxScale={Math.max(open.s, under.s) * 1.1}
      reveal
      revealDelay={DROP_AFTER}
      revealStagger={DROP_GAP}
      interactive={false}
      pinSize={40}
      palette={palette}
      artChildren={
        points.length > 1 ? (
          <AnimatedPath
            d={d}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.5 / open.s}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[length, length]}
            animatedProps={drawn}
          />
        ) : null
      }
    />
  );
}

/** The day the places make, as the paper ticket Home uses. It comes up on the sky under the map, where paper reads; over the map's own paper it had nothing to stand out from. */
function DayTicket({ s, stops, name, left, width, top }: { s: SharedValue<number>; stops: Place[]; name: string; left: number; width: number; top: number }) {
  const style = useAnimatedStyle(() => {
    const t = s.get();
    return {
      opacity: interpolate(t, [2.5, 2.95, 3.1, 3.5], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(t, [2.5, 3], [40, 0], Extrapolation.CLAMP) }],
    };
  });
  const shown = stops.slice(0, 4);
  const more = stops.length - shown.length;
  return (
    <Tone value="light">
      <Animated.View style={[styles.ticket, { left, width, top }, style]} pointerEvents="none">
        <View style={styles.ticketBody}>
          <Text variant="title" numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.rows}>
            {shown.map((p, i) => (
              <View key={p.id} style={styles.row}>
                <Text variant="data" style={styles.time}>
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
        </View>
        <View style={styles.ticketStub}>
          <View style={styles.tear}>
            {Array.from({ length: 24 }, (_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>
          <Text style={styles.count}>{stops.length}</Text>
          <Text variant="micro" color={light.inkSoft}>
            stops
          </Text>
        </View>
      </Animated.View>
    </Tone>
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

const NOTCH = 10;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  globe: { position: 'absolute' },
  mark: { position: 'absolute', left: 0, top: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: skyAccent },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: skyAccent, borderWidth: 2, borderColor: '#FFFFFF' },
  card: { position: 'absolute' },
  cardFace: { flex: 1, borderRadius: radii.thumb, overflow: 'hidden', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.95)', boxShadow: shadows.card },
  // The picked card's ring: the button's black, a hair outside the white edge.
  cardRing: { position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, borderWidth: 3, borderColor: skyCta },
  cardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  // A dark chip, so the label reads over any photo in any corner.
  kind: { position: 'absolute', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(14,16,20,0.66)' },
  kindText: { fontFamily: fonts.sansSemi },
  bottomLeft: { left: 7, bottom: 7 },
  topRight: { right: 7, top: 7 },
  bottomRight: { right: 7, bottom: 7 },
  play: {
    position: 'absolute',
    left: '50%',
    top: '42%',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    paddingLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,16,20,0.55)',
  },
  dots: { position: 'absolute', right: 10, top: 11, flexDirection: 'row', gap: 3 },
  pageDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  pageDotOn: { backgroundColor: '#FFFFFF' },
  tick: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyCta,
    boxShadow: shadows.button,
  },
  window: { position: 'absolute', overflow: 'hidden', borderColor: skyInk.rim },
  held: { position: 'absolute', left: 0, top: 0 },
  map: { position: 'absolute' },
  ticket: { position: 'absolute', flexDirection: 'row' },
  ticketBody: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: light.canvas,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderTopRightRadius: NOTCH,
    borderBottomRightRadius: NOTCH,
    boxShadow: shadows.card,
  },
  ticketStub: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: light.canvas,
    borderTopLeftRadius: NOTCH,
    borderBottomLeftRadius: NOTCH,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    boxShadow: shadows.card,
  },
  tear: { position: 'absolute', left: 0, top: NOTCH + 2, bottom: NOTCH + 2, width: 1.5, gap: 4, overflow: 'hidden' },
  dash: { width: 1.5, height: 5, backgroundColor: light.lineStrong },
  count: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.8, color: light.ink },
  rows: { marginTop: 6, gap: 3 },
  row: { flexDirection: 'row', gap: 8 },
  time: { width: 62 },
  rowName: { flex: 1 },
  words: { position: 'absolute', left: GUTTER, right: GUTTER, gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.9, color: skyInk.strong },
});
