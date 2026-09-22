import { Image } from 'expo-image';
import { memo, useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import type { City, CityMapArt, Place } from '@/data/types';
import { smoothPath, type Point } from '@/lib/geo';
import { EASE_IN_OUT, EASE_OUT, SPRING_LAND, SPRING_SETTLE } from '@/lib/motion';
import { fonts, light, shadows } from '@/theme/tokens';

import { Text } from './Text';

// Map world, in stylised map units. A region map (see `src/data/regions.ts`) passes its own.
export const WORLD = { x0: -150, y0: -350, w: 1350, h: 2100 };
export type World = typeof WORLD;
const DEFAULT_PIN = 44;

export type Camera = { x: SharedValue<number>; y: SharedValue<number>; s: SharedValue<number> };
export type CameraValue = { x: number; y: number; s: number };

export function useCamera(init: CameraValue): Camera {
  return { x: useSharedValue(init.x), y: useSharedValue(init.y), s: useSharedValue(init.s) };
}

/** Fit points into a sub-rectangle of the map view (e.g. the area above a bottom panel). */
export function fitCameraToRect(
  points: Point[],
  view: { w: number; h: number },
  rect: { top: number; bottom: number; left?: number; right?: number },
  padding = 110,
): CameraValue {
  const left = rect.left ?? 0;
  const right = rect.right ?? 0;
  const rw = view.w - left - right;
  const rh = view.h - rect.top - rect.bottom;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const s = Math.max(
    0.2,
    Math.min(
      1.1,
      Math.min(
        rw / (Math.max(...xs) - Math.min(...xs) + padding * 2),
        rh / (Math.max(...ys) - Math.min(...ys) + padding * 2),
      ),
    ),
  );
  // Shift so the fitted centre lands in the middle of the rect, not the middle of the view.
  const rectCx = left + rw / 2;
  const rectCy = rect.top + rh / 2;
  return { x: cx - (rectCx - view.w / 2) / s, y: cy - (rectCy - view.h / 2) / s, s };
}

export function flyTo(camera: Camera, target: CameraValue, duration = 450) {
  'worklet';
  const cfg = { duration, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System };
  camera.x.set(withTiming(target.x, cfg));
  camera.y.set(withTiming(target.y, cfg));
  camera.s.set(withTiming(target.s, cfg));
}

export type MapPin = {
  id: string;
  place: Place;
  number?: number;
  /** Where to draw it, when not the place's own city position (e.g. its spot on a region map). */
  point?: Point;
};

type Props = {
  /** The art to draw. A region reuses the same shape, so it can be passed here too. */
  city: Pick<City, 'map'>;
  pins: MapPin[];
  width: number;
  height: number;
  camera: Camera;
  /** Largest scale this map will be shown at. The art renders at this size so it only ever scales down (stays crisp). */
  maxScale: number;
  activeId?: SharedValue<string | null>;
  reveal?: boolean;
  revealDelay?: number;
  onRevealed?: () => void;
  onPinPress?: (id: string) => void;
  interactive?: boolean;
  pinSize?: number;
  /** Extra layers drawn inside the map art, in world units (e.g. a route). */
  artChildren?: ReactNode;
  /** The world the art is drawn in. Defaults to the city world. */
  world?: World;
};

export function CityMap({
  city,
  pins,
  width,
  height,
  camera,
  maxScale,
  activeId,
  reveal = false,
  revealDelay = 0,
  onRevealed,
  onPinPress,
  interactive = true,
  pinSize = DEFAULT_PIN,
  artChildren,
  world = WORLD,
}: Props) {
  const r = maxScale;

  const worldStyle = useAnimatedStyle(() => {
    const s = camera.s.get();
    return {
      transform: [
        { translateX: width / 2 - (camera.x.get() - world.x0) * s },
        { translateY: height / 2 - (camera.y.get() - world.y0) * s },
        { scale: s / r },
      ],
    };
  });

  const start = useSharedValue({ x: 0, y: 0, s: 1 });
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(interactive)
      .minDistance(6)
      .onStart(() => {
        start.set({ x: camera.x.get(), y: camera.y.get(), s: camera.s.get() });
      })
      .onUpdate((e) => {
        const s = camera.s.get();
        camera.x.set(start.get().x - e.translationX / s);
        camera.y.set(start.get().y - e.translationY / s);
      });
    const pinch = Gesture.Pinch()
      .enabled(interactive)
      .onStart(() => {
        start.set({ x: camera.x.get(), y: camera.y.get(), s: camera.s.get() });
      })
      .onUpdate((e) => {
        const st = start.get();
        const s = Math.max(r * 0.35, Math.min(r, st.s * e.scale));
        // Keep the world point under the fingers fixed while zooming.
        const fx = st.x + (e.focalX - width / 2) / st.s;
        const fy = st.y + (e.focalY - height / 2) / st.s;
        camera.s.set(s);
        camera.x.set(fx - (e.focalX - width / 2) / s);
        camera.y.set(fy - (e.focalY - height / 2) / s);
      });
    return Gesture.Simultaneous(pan, pinch);
  }, [camera, height, interactive, r, start, width]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        // Past the drawn world, coastal maps continue as sea (it lies west), inland maps as land.
        style={[styles.root, { width, height, backgroundColor: city.map.coast ? light.mapSea : light.mapLand }]}
        collapsable={false}
      >
        <Animated.View style={[styles.world, { width: world.w * r, height: world.h * r }, worldStyle]}>
          <MapArt art={city.map} r={r} world={world}>
            {artChildren}
          </MapArt>
        </Animated.View>
        {pins.map((pin, i) => (
          <MapPinView
            key={pin.id}
            pin={pin}
            index={i}
            count={pins.length}
            camera={camera}
            width={width}
            height={height}
            activeId={activeId}
            reveal={reveal}
            revealDelay={revealDelay}
            onRevealed={i === pins.length - 1 ? onRevealed : undefined}
            onPress={onPinPress}
            size={pinSize}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

const MapArt = memo(function MapArt({
  art,
  r,
  world,
  children,
}: {
  art: CityMapArt;
  r: number;
  world: World;
  children?: ReactNode;
}) {
  const land = useMemo(() => {
    if (!art.coast) return null;
    const first = art.coast[0];
    const last = art.coast[art.coast.length - 1];
    return `${smoothPath(art.coast)} L 3000 ${last[1]} L 3000 ${first[1]} Z`;
  }, [art.coast]);

  return (
    <Svg
      width={world.w * r}
      height={world.h * r}
      viewBox={`${world.x0} ${world.y0} ${world.w} ${world.h}`}
    >
      <Rect x={world.x0} y={world.y0} width={world.w} height={world.h} fill={land ? light.mapSea : light.mapLand} />
      {land ? <Path d={land} fill={light.mapLand} stroke={light.mapCoast} strokeWidth={3} /> : null}
      {art.water?.map((w, i) => (
        <Ellipse key={`w${i}`} cx={w.cx} cy={w.cy} rx={w.rx} ry={w.ry} fill={light.mapSea} stroke={light.mapCoast} strokeWidth={3} />
      ))}
      {art.rivers?.map((pts, i) => (
        <Path key={`r${i}`} d={smoothPath(pts)} stroke={light.mapSea} strokeWidth={26} strokeLinecap="round" fill="none" />
      ))}
      {art.hills.map((h, i) => (
        <Ellipse key={`h${i}`} cx={h.cx} cy={h.cy} rx={h.rx} ry={h.ry} fill="none" stroke={light.line} strokeWidth={2} />
      ))}
      {art.borders?.map((pts, i) => (
        <Path
          key={`b${i}`}
          d={smoothPath(pts)}
          stroke={light.mapTrail}
          strokeWidth={3}
          strokeDasharray="2 14"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {art.roads.map((pts, i) => (
        <Path key={`rd${i}`} d={smoothPath(pts)} stroke={light.mapRoad} strokeWidth={7} strokeLinecap="round" fill="none" />
      ))}
      {art.trails?.map((pts, i) => (
        <Path
          key={`t${i}`}
          d={smoothPath(pts)}
          stroke={light.mapTrail}
          strokeWidth={3}
          strokeDasharray="1 12"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {art.labels.map((l, i) =>
        l.kind === 'sea' ? (
          <SvgText
            key={`l${i}`}
            x={l.x}
            y={l.y}
            fill={light.mapSeaLabel}
            fontFamily={fonts.serifItalic}
            fontSize={48}
            textAnchor={l.anchor ?? 'start'}
          >
            {l.text}
          </SvgText>
        ) : (
          <SvgText
            key={`l${i}`}
            x={l.x}
            y={l.y}
            fill={light.mapLabel}
            fontFamily={fonts.sansSemi}
            fontSize={20}
            letterSpacing={4}
            textAnchor={l.anchor ?? 'start'}
          >
            {l.text}
          </SvgText>
        ),
      )}
      {children}
    </Svg>
  );
});

type PinProps = {
  pin: MapPin;
  index: number;
  count: number;
  camera: Camera;
  width: number;
  height: number;
  activeId?: SharedValue<string | null>;
  reveal: boolean;
  revealDelay: number;
  onRevealed?: () => void;
  onPress?: (id: string) => void;
  size: number;
};

function MapPinView({ pin, index, camera, width, height, activeId, reveal, revealDelay, onRevealed, onPress, size }: PinProps) {
  const reduced = useReducedMotion();
  const drop = useSharedValue(reveal ? 0 : 1);
  const selected = useSharedValue(0);

  // Mount-only: a parent re-render must never restart the drop.
  useEffect(() => {
    if (!reveal) return;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished && onRevealed) scheduleOnRN(onRevealed);
    };
    const delay = revealDelay + index * 80;
    drop.set(
      withDelay(
        delay,
        reduced ? withTiming(1, { duration: 260, easing: EASE_OUT }, done) : withSpring(1, SPRING_LAND, done),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAnimatedReaction(
    () => (activeId ? activeId.get() === pin.id : false),
    (on, prev) => {
      if (on !== prev) selected.set(withSpring(on ? 1 : 0, SPRING_SETTLE));
    },
  );

  const style = useAnimatedStyle(() => {
    const s = camera.s.get();
    const p = drop.get();
    const at = pin.point ?? pin.place.map;
    const x = width / 2 + (at[0] - camera.x.get()) * s - size / 2;
    const y = height / 2 + (at[1] - camera.y.get()) * s - size / 2;
    const lift = reduced ? 0 : (1 - p) * -24;
    return {
      opacity: Math.min(1, p * 1.4),
      transform: [
        { translateX: x },
        { translateY: y + lift },
        { scale: (reduced ? 1 : 0.9 + 0.1 * p) * (1 + 0.27 * selected.get()) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.pin, { width: size, height: size }, style]}>
      <Pressable
        onPress={() => onPress?.(pin.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={pin.number ? `Stop ${pin.number}, ${pin.place.name}` : pin.place.name}
        style={[styles.pinShadow, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={[styles.pinRing, { width: size, height: size, borderRadius: size / 2, borderWidth: size < 40 ? 2 : 2.5 }]}>
          <Image source={pin.place.photo} style={styles.pinPhoto} contentFit="cover" transition={0} />
        </View>
        {pin.number ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pin.number}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: light.mapLand },
  world: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left' },
  pin: { position: 'absolute', left: 0, top: 0 },
  // White-rimmed photo pins, lifted off the paper map by a soft shadow.
  pinRing: {
    borderColor: light.panel,
    backgroundColor: light.canvasTop,
    overflow: 'hidden',
  },
  // On the unclipped wrapper, so overflow: hidden on the ring can't cut the shadow off.
  pinShadow: { boxShadow: shadows.pin },
  pinPhoto: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: light.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: light.panel,
  },
  badgeText: { fontFamily: fonts.sansSemi, fontSize: 11, color: light.ctaInk, fontVariant: ['tabular-nums'] },
});
