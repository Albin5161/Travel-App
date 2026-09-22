import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { CityMap, fitCameraToRect, flyTo, useCamera } from '@/components/CityMap';
import { IconButton } from '@/components/IconButton';
import { costLabel } from '@/components/PlaceMeta';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { getCity, getLocalPicks } from '@/data/api';
import { buildPlan, findGap, type PlanStop } from '@/data/plan';
import type { DayPart, Place } from '@/data/types';
import { formatClock, formatDuration, smoothPath, smoothPathLength } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { EASE_IN_OUT, FADE_OUT, fadeUp, REFLOW } from '@/lib/motion';
import { useCityPlaces, useTrips } from '@/state/trips';
import { fonts, light } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const PART_TITLE: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const ROW_ENTER = fadeUp(0);
const READING_LINE = 150;

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = getCity(id);
  const { kept, locals } = useCityPlaces(id);
  const { dispatch } = useTrips();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const selected = [...kept, ...locals];
  const plan = buildPlan(selected);
  const gap = findGap(selected, getLocalPicks(id));

  const MAP_H = Math.round(H * 0.46);
  const points = plan.stops.map((s) => s.place.map);
  const fitRect = { top: insets.top + 56, bottom: 44 };
  const fit = fitCameraToRect(points.length ? points : [[500, 700]], { w: W, h: MAP_H }, fitRect, 120);
  const focusScale = fit.s * 1.6;
  const camera = useCamera(fit);
  const activeId = useSharedValue<string | null>(null);

  // Route draws itself once the numbered pins have popped in; redraws when a stop is added.
  const routeKey = plan.stops.map((s) => s.place.id).join('|');
  const progress = useSharedValue(0);
  const firstDraw = useRef(true);
  useEffect(() => {
    const delay = firstDraw.current ? 300 + plan.stops.length * 80 : 120;
    firstDraw.current = false;
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration: reduced ? 250 : 900, easing: EASE_IN_OUT })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Scroll-synced camera: the stop crossing the reading line becomes active.
  const scrollY = useSharedValue(0);
  const rowYs = useSharedValue<number[]>([]);
  const rowYsRef = useRef<number[]>([]);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const stopIds = plan.stops.map((s) => s.place.id);
  const visibleCy = (fitRect.top + (MAP_H - fitRect.bottom)) / 2;

  useAnimatedReaction(
    () => {
      const y = scrollY.get();
      if (y < 40) return -1;
      const line = y + READING_LINE;
      const ys = rowYs.get();
      let idx = -1;
      for (let i = 0; i < ys.length; i++) if (ys[i] !== undefined && ys[i] <= line) idx = i;
      return idx;
    },
    (idx, prev) => {
      if (idx === prev) return;
      if (idx < 0) {
        activeId.set(null);
        flyTo(camera, fit);
        return;
      }
      activeId.set(stopIds[idx]);
      const [px, py] = points[idx];
      flyTo(camera, { x: px, y: py - (visibleCy - MAP_H / 2) / focusScale, s: focusScale });
    },
    [routeKey],
  );

  const setRowY = (i: number, y: number) => {
    rowYsRef.current[i] = y;
    rowYs.set([...rowYsRef.current]);
  };

  if (!city) return null;

  const addGap = (place: Place) => {
    haptic.light();
    dispatch({ type: 'addLocal', cityId: id, placeId: place.id });
  };

  const save = () => {
    haptic.success();
    dispatch({ type: 'saveTrip', cityId: id });
    router.dismissTo('/');
  };

  const indexOf = new Map(plan.stops.map((s, i) => [s.place.id, i]));

  return (
    <View style={styles.fill}>
      <View style={{ height: MAP_H }}>
        <CityMap
          city={city}
          pins={plan.stops.map((s, i) => ({ id: s.place.id, place: s.place, number: i + 1 }))}
          width={W}
          height={MAP_H}
          camera={camera}
          maxScale={focusScale * 1.1}
          pinSize={30}
          activeId={activeId}
          reveal
          revealDelay={200}
          onPinPress={(pid) => router.push({ pathname: '/place/[id]', params: { id: pid } })}
          artChildren={
            points.length > 1 ? (
              <Route key={routeKey} d={smoothPath(points)} length={smoothPathLength(points)} progress={progress} width={3 / fit.s} />
            ) : null
          }
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(245,244,241,0.85)', 'rgba(245,244,241,0)']}
          style={[styles.topFade, { height: insets.top + 80 }]}
        />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <IconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
        </View>
      </View>

      <View style={styles.panel}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: insets.bottom + 120 }}
        >
          <Text variant="micro">
            {plan.stops.length} stops · {plan.totalKm.toFixed(1)} km
          </Text>
          <Text variant="display" style={styles.title}>
            Your day in {city.name}
          </Text>

          {plan.stops.length === 0 ? (
            <Text variant="body">You skipped everything. Go back and keep a few places to plan a day.</Text>
          ) : null}

          {/* Flat children so each row's onLayout y is relative to the scroll content. */}
          {plan.parts.flatMap((part) => [
            <Animated.View key={`h-${part.part}`} layout={REFLOW} style={styles.partHeader}>
              <Text variant="headline">{PART_TITLE[part.part]}</Text>
              <Text variant="data">{formatClock(part.stops[0].startMinutes)}</Text>
            </Animated.View>,
            ...part.stops.map((stop, j) => {
              const i = indexOf.get(stop.place.id) ?? 0;
              return (
                <Animated.View
                  key={stop.place.id}
                  entering={ROW_ENTER}
                  layout={REFLOW}
                  onLayout={(e) => setRowY(i, e.nativeEvent.layout.y)}
                >
                  {stop.legBefore ? <Leg stop={stop} compact={j === 0} /> : null}
                  <StopRow stop={stop} number={i + 1} activeId={activeId} />
                </Animated.View>
              );
            }),
            part.part === 'evening' && gap ? <GapCard key="gap" place={gap} onAdd={() => addGap(gap)} /> : null,
          ])}
          {gap && !plan.parts.some((p) => p.part === 'evening') ? (
            <GapCard place={gap} onAdd={() => addGap(gap)} />
          ) : null}
        </Animated.ScrollView>

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', light.panel]}
          style={[styles.bottomFade, { height: insets.bottom + 110 }]}
        />
        <View style={[styles.floating, { paddingBottom: insets.bottom + 16 }]}>
          <Button label="Save this day" onPress={save} disabled={plan.stops.length === 0} />
        </View>
      </View>
    </View>
  );
}

function Route({ d, length, progress, width }: { d: string; length: number; progress: SharedValue<number>; width: number }) {
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.get()) }));
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={light.ink}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}

function Leg({ stop, compact }: { stop: PlanStop; compact?: boolean }) {
  const leg = stop.legBefore!;
  const label =
    leg.mode === 'walk'
      ? `${leg.minutes} min walk · ${leg.km.toFixed(1)} km`
      : `${formatDuration(leg.minutes)} by ${leg.mode} · ${leg.km.toFixed(1)} km`;
  return (
    <View style={[styles.leg, compact && styles.legCompact]}>
      <View style={styles.legLine} />
      <Feather name={leg.mode === 'walk' ? 'navigation' : 'truck'} size={12} color={light.inkFaint} />
      <Text variant="data">{label}</Text>
    </View>
  );
}

function StopRow({ stop, number, activeId }: { stop: PlanStop; number: number; activeId: SharedValue<string | null> }) {
  const id = stop.place.id;
  const dim = useAnimatedStyle(() => {
    const a = activeId.get();
    return { opacity: withTiming(a === null || a === id ? 1 : 0.5, { duration: 180 }) };
  });
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/place/[id]', params: { id } })}
      accessibilityRole="button"
      accessibilityLabel={`Stop ${number}, ${stop.place.name}, ${formatClock(stop.startMinutes)}`}
    >
      <Animated.View style={[styles.stop, dim]}>
        <View style={styles.stopNumber}>
          <Text style={styles.stopNumberText}>{number}</Text>
        </View>
        <Image source={stop.place.photo} style={styles.thumb} contentFit="cover" transition={0} />
        <View style={styles.stopText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {stop.place.name}
          </Text>
          <Text variant="data" numberOfLines={1}>
            {formatClock(stop.startMinutes)} · {formatDuration(stop.place.minutes)} · {costLabel(stop.place.cost)}
          </Text>
          {stop.place.source.kind === 'local' ? (
            <Text variant="micro" color={light.accent}>
              Recommended by locals
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </PressableScale>
  );
}

function GapCard({ place, onAdd }: { place: Place; onAdd: () => void }) {
  return (
    <Animated.View entering={ROW_ENTER} exiting={FADE_OUT} style={styles.gap}>
      <Text variant="serifItalic">Nothing planned for dinner.</Text>
      <View style={styles.gapRow}>
        <Image source={place.photo} style={styles.thumb} contentFit="cover" transition={0} />
        <View style={styles.stopText}>
          <Text variant="micro" color={light.accent}>
            Recommended by locals
          </Text>
          <Text variant="bodyStrong">{place.name}</Text>
          <Text variant="body" numberOfLines={2}>
            {place.why}
          </Text>
        </View>
      </View>
      <Button kind="secondary" compact label="Add to evening" onPress={onAdd} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.mapLand },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  topBar: { position: 'absolute', left: 16, top: 0 },
  panel: {
    flex: 1,
    marginTop: -28,
    backgroundColor: light.panel,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  title: { marginTop: 6, marginBottom: 8 },
  partHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  stopNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: light.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumberText: { fontFamily: fonts.sansSemi, fontSize: 12, color: light.ctaInk, fontVariant: ['tabular-nums'] },
  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: light.canvasTop },
  stopText: { flex: 1, gap: 2 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingVertical: 8 },
  legCompact: { paddingTop: 0 },
  legLine: { width: 2, height: 18, borderRadius: 1, backgroundColor: light.line, marginRight: 4 },
  gap: {
    marginTop: 16,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: light.lineStrong,
    backgroundColor: light.canvas,
    gap: 12,
  },
  gapRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  floating: { position: 'absolute', left: 20, right: 20, bottom: 0 },
});
