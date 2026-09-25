import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { PassportStamp } from '@/components/motion/PassportStamp';
import { StopActions } from '@/components/plan/StopActions';
import { costLabel, typeLine } from '@/components/PlaceMeta';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { getCity, getLocalPicks } from '@/data/api';
import {
  addStop,
  changedStops,
  formatDay,
  formatRange,
  fromIso,
  moveToDay,
  partOf,
  pinsOf,
  removeStop,
  reorder,
  rulePlanner,
  swapStop,
  togglePin,
  type TripPlan,
  type TripStop,
} from '@/data/planner';
import type { DayPart, Place } from '@/data/types';
import { formatClock, formatDuration, smoothPath, smoothPathLength } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { EASE_IN_OUT, FADE_IN, FADE_OUT, fadeUp, REFLOW } from '@/lib/motion';
import { customStops } from '@/data/custom';
import { usePlanWriter } from '@/state/live';
import { useCityPlaces, useTrips } from '@/state/trips';
import { fonts, light } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const PART_TITLE: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const PACE_LABEL = { relaxed: 'Relaxed', balanced: 'Balanced', packed: 'Packed' } as const;
const GETTING_LABEL = { local: 'Walking and autos', drive: 'Own vehicle', bus: 'By bus' } as const;
const ROW_ENTER = fadeUp(0);
const READING_LINE = 150;
// A regenerate is a moment, not a wait: long enough to read as work, short enough not to stall.
const REGENERATE_MS = 900;
// Seeds tried before admitting the places only fit one way.
const REGENERATE_TRIES = 6;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = getCity(id);
  // Planned from the places not skipped in the place sheet.
  const { kept: collected } = useCityPlaces(id);
  const { state, dispatch } = useTrips();
  const plan = state.tripPlans[id];
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const [day, setDay] = useState(0);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<TripStop | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  const [stamping, setStamping] = useState(false);

  // No plan yet (a reload, or a deep link): ask the questions first.
  useEffect(() => {
    if (!plan) router.replace({ pathname: '/trip/[id]', params: { id } });
  }, [id, plan]);

  const dayIndex = Math.min(day, Math.max(0, (plan?.days.length ?? 1) - 1));
  const today = plan?.days[dayIndex];
  const stops = today?.stops ?? [];

  const MAP_H = Math.round(H * 0.4);
  const points = stops.map((s) => s.place.map);
  const fitRect = { top: insets.top + 56, bottom: 44 };
  const fit = fitCameraToRect(points.length ? points : [[500, 700]], { w: W, h: MAP_H }, fitRect, 120);
  const focusScale = fit.s * 1.6;
  const camera = useCamera(fit);
  const activeId = useSharedValue<string | null>(null);

  // The route redraws for each day and after each edit; the camera fits the day it's showing.
  const routeKey = `${dayIndex}:${stops.map((s) => s.place.id).join('|')}`;
  const progress = useSharedValue(0);
  const firstDraw = useRef(true);
  useEffect(() => {
    const delay = firstDraw.current ? 300 + stops.length * 80 : 120;
    firstDraw.current = false;
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration: reduced ? 250 : 900, easing: EASE_IN_OUT })));
    activeId.set(null);
    flyTo(camera, fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Scroll-synced camera: the stop crossing the reading line becomes active.
  const scrollY = useSharedValue(0);
  const rowYs = useSharedValue<number[]>([]);
  const rowYsRef = useRef<number[]>([]);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const stopIds = stops.map((s) => s.place.id);
  const visibleCy = (fitRect.top + (MAP_H - fitRect.bottom)) / 2;
  useEffect(() => {
    rowYsRef.current = [];
    rowYs.set([]);
  }, [routeKey, rowYs]);

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
      if (idx < 0 || idx >= points.length) {
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

  // A flash lasts one showing; a note fades after a few seconds.
  // Edits save here, and to everyone's phone once the trip is shared.
  const writePlan = usePlanWriter(id);
  useEffect(() => {
    if (flash.size === 0) return;
    const t = setTimeout(() => setFlash(new Set()), 1600);
    return () => clearTimeout(t);
  }, [flash]);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3600);
    return () => clearTimeout(t);
  }, [note]);

  if (!city || !plan || !today) return null;

  const update = (next: TripPlan) => writePlan(next);
  const inPlan = new Set(plan.days.flatMap((d) => d.stops.map((s) => s.place.id)));
  const locals = getLocalPicks(id);
  const candidates = [...plan.left, ...locals].filter((p, i, all) => !inPlan.has(p.id) && all.findIndex((q) => q.id === p.id) === i);
  const isSaved = (p: Place) => collected.some((c) => c.id === p.id);
  const dayLabels = plan.days.map((d, i) => (d.date ? `Day ${i + 1} · ${formatDay(d.date).replace(/ \w+$/, '')}` : `Day ${i + 1}`));

  const regenerate = async () => {
    if (busy) return;
    haptic.light();
    setBusy(true);
    setEditing(false);
    setNote(null);
    // Stops people typed in aren't saved places: they ride along pinned to their day.
    const input = {
      cityId: id,
      saved: [...collected, ...customStops(plan).map((c) => c.place)],
      suggestions: locals,
      prefs: plan.prefs,
      pins: pinsOf(plan),
      removed: plan.removed,
    };
    let next = plan;
    let changed = new Set<string>();
    const [result] = await Promise.all([
      (async () => {
        for (let k = 1; k <= REGENERATE_TRIES && changed.size === 0; k++) {
          next = await rulePlanner.plan({ ...input, seed: plan.seed + k });
          changed = changedStops(plan, next);
        }
        return { next, changed };
      })(),
      wait(REGENERATE_MS),
    ]);
    setBusy(false);
    if (result.changed.size === 0) {
      setNote('Same plan. With these places and answers, this is the only good fit.');
      return;
    }
    haptic.success();
    update(result.next);
    setFlash(result.changed);
  };

  // The stamp's paper veil fades into the share card. Replaced, not pushed: the plan is saved, so
  // there's nothing to come back to.
  const save = () => setStamping(true);
  const saved = () => {
    dispatch({ type: 'saveTrip', cityId: id });
    router.replace({ pathname: '/share/[id]', params: { id } });
  };

  // Stops grouped into parts of the day by their clock time, keeping the day's order.
  const parts: { part: DayPart; stops: { stop: TripStop; i: number }[] }[] = [];
  stops.forEach((stop, i) => {
    const part = partOf(stop.startMinutes);
    const last = parts[parts.length - 1];
    if (last && last.part === part) last.stops.push({ stop, i });
    else parts.push({ part, stops: [{ stop, i }] });
  });

  const prefs = plan.prefs;
  const n = plan.days.length;
  const meta = [
    prefs.start ? formatRange(prefs.start, n) : `${n} ${n === 1 ? 'day' : 'days'}, dates to come`,
    PACE_LABEL[prefs.pace],
    GETTING_LABEL[prefs.getting],
  ].join(' · ');
  const left = plan.left.filter((p) => !inPlan.has(p.id));
  // Asking for more days than there are places is easy; say so rather than show empty days bare.
  const emptyDays = plan.days.filter((d) => d.stops.length === 0).length;
  const placed = plan.days.reduce((sum, d) => sum + d.stops.filter((s) => !s.suggested).length, 0);

  return (
    <View style={styles.fill}>
      <View style={{ height: MAP_H }}>
        <CityMap
          city={city}
          pins={stops.map((s, i) => ({ id: s.place.id, place: s.place, number: i + 1 }))}
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
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: insets.bottom + 130 }}
        >
          <Text variant="micro" numberOfLines={2}>
            {meta}
          </Text>
          <Text variant="display" style={styles.title}>
            {n === 1 ? `Your day in ${city.name}` : `Your ${n} days in ${city.name}`}
          </Text>

          <View style={styles.tools}>
            <Tool icon={editing ? 'check' : 'edit-2'} label={editing ? 'Done' : 'Edit'} on={editing} onPress={() => setEditing((e) => !e)} />
            <Tool icon="refresh-cw" label={busy ? 'Reshuffling…' : 'Regenerate'} onPress={regenerate} />
            <Tool icon="sliders" label="Change answers" onPress={() => router.push({ pathname: '/trip/[id]', params: { id, from: 'plan' } })} />
          </View>
          {note ? (
            <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
              <Text variant="label" color={light.inkSoft} style={styles.note}>
                {note}
              </Text>
            </Animated.View>
          ) : (
            <Text variant="label" color={light.inkFaint} style={styles.note}>
              {editing ? 'Move stops with the arrows, or tap ⋯ for more.' : 'Pin the stops you love. Regenerate keeps them and reshuffles the rest.'}
            </Text>
          )}

          {emptyDays > 0 && n > 1 ? (
            <View style={styles.thin}>
              <Feather name="info" size={14} color={light.inkSoft} />
              <Text variant="label" color={light.inkSoft} style={styles.thinText}>
                {`Your ${placed} ${placed === 1 ? 'place fills' : 'places fill'} ${n - emptyDays} of ${n} days. Save more places here, or `}
                <Text variant="label" style={styles.thinLink} onPress={() => router.push({ pathname: '/trip/[id]', params: { id, from: 'plan' } })}>
                  shorten the trip
                </Text>
                .
              </Text>
            </View>
          ) : null}

          {n > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.days} contentContainerStyle={styles.daysContent}>
              {dayLabels.map((label, i) => {
                const on = i === dayIndex;
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      if (on) return;
                      haptic.selection();
                      setDay(i);
                    }}
                    style={[styles.dayTab, on && styles.dayTabOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    <Text variant="label" color={on ? light.ctaInk : light.ink}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={[styles.list, busy && styles.busy]}>
            <Text variant="data" style={styles.daySummary}>
              {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
              {today.totalKm > 0 ? ` · ${today.totalKm.toFixed(1)} km` : ''}
            </Text>

            {stops.length === 0 ? (
              <Text variant="body" style={styles.emptyDay}>
                Nothing planned this day. Add a saved spot below, move one here, or regenerate.
              </Text>
            ) : null}

            {/* Flat children so each row's onLayout y is relative to the scroll content. */}
            {parts.flatMap((part) => [
              <Animated.View key={`h-${part.part}-${part.stops[0].i}`} layout={REFLOW} style={styles.partHeader}>
                <Text variant="headline">{PART_TITLE[part.part]}</Text>
                <Text variant="data">{formatClock(part.stops[0].stop.startMinutes)}</Text>
              </Animated.View>,
              ...part.stops.map(({ stop, i }, j) => (
                <Animated.View
                  key={stop.place.id}
                  entering={ROW_ENTER}
                  layout={REFLOW}
                  onLayout={(e) => setRowY(i, e.nativeEvent.layout.y)}
                >
                  {stop.legBefore ? <Leg stop={stop} compact={j === 0} /> : null}
                  <StopRow
                    stop={stop}
                    number={i + 1}
                    activeId={activeId}
                    flash={flash.has(stop.place.id)}
                    editing={editing}
                    first={i === 0}
                    last={i === stops.length - 1}
                    onPin={() => {
                      haptic.selection();
                      update(togglePin(plan, dayIndex, stop.place.id));
                    }}
                    onMove={(by) => {
                      haptic.selection();
                      update(reorder(plan, dayIndex, stop.place.id, by));
                    }}
                    onMore={() => setSheet(stop)}
                  />
                </Animated.View>
              )),
            ])}

            <PressableScale
              onPress={() => router.push({ pathname: '/addstop/[id]', params: { id, day: String(dayIndex) } })}
              style={styles.addOwn}
              accessibilityRole="button"
              accessibilityLabel="Add your own stop"
            >
              <Feather name="plus" size={16} color={light.ink} />
              <Text variant="label">Add your own stop</Text>
            </PressableScale>

            {left.length > 0 ? (
              <View style={styles.left}>
                <Text variant="micro">Not in this plan · {left.length}</Text>
                {left.map((p) => (
                  <Animated.View key={p.id} entering={ROW_ENTER} exiting={FADE_OUT} layout={REFLOW} style={styles.leftRow}>
                    <Image source={p.photo} style={styles.leftThumb} contentFit="cover" transition={0} />
                    <View style={styles.stopText}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text variant="label" color={light.inkSoft} numberOfLines={1}>
                        {typeLine(p)}
                      </Text>
                    </View>
                    <Button
                      kind="secondary"
                      compact
                      label={n > 1 ? `Add to day ${dayIndex + 1}` : 'Add'}
                      onPress={() => {
                        haptic.light();
                        update(addStop(plan, dayIndex, p, false));
                      }}
                    />
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.ScrollView>

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', light.panel]}
          style={[styles.bottomFade, { height: insets.bottom + 110 }]}
        />
        <View style={[styles.floating, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            label={n === 1 ? 'Save this day' : `Save this ${n}-day plan`}
            onPress={save}
            disabled={plan.days.every((d) => d.stops.length === 0) || stamping || busy}
          />
        </View>
      </View>

      <StopActions
        stop={sheet}
        days={dayLabels}
        day={dayIndex}
        candidates={candidates}
        onPin={() => {
          if (!sheet) return;
          haptic.selection();
          update(togglePin(plan, dayIndex, sheet.place.id));
          setSheet(null);
        }}
        onMove={(to) => {
          if (!sheet) return;
          haptic.light();
          update(moveToDay(plan, dayIndex, sheet.place.id, to));
          setSheet(null);
        }}
        onSwap={(p) => {
          if (!sheet) return;
          haptic.light();
          update(swapStop(plan, dayIndex, sheet.place.id, p, !isSaved(p)));
          setFlash(new Set([p.id]));
          setSheet(null);
        }}
        onRemove={() => {
          if (!sheet) return;
          haptic.light();
          update(removeStop(plan, dayIndex, sheet.place.id));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      {stamping ? (
        <PassportStamp city={city.name} date={today.date ? fromIso(plan.days[0].date ?? today.date) : new Date()} onDone={saved} />
      ) : null}
    </View>
  );
}

function Tool({
  icon,
  label,
  on,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  on?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.tool, on && styles.toolOn]}>
        <Feather name={icon} size={13} color={on ? light.ctaInk : light.ink} />
        <Text variant="label" color={on ? light.ctaInk : light.ink}>
          {label}
        </Text>
      </View>
    </PressableScale>
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

function Leg({ stop, compact }: { stop: TripStop; compact?: boolean }) {
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

function StopRow({
  stop,
  number,
  activeId,
  flash,
  editing,
  first,
  last,
  onPin,
  onMove,
  onMore,
}: {
  stop: TripStop;
  number: number;
  activeId: SharedValue<string | null>;
  flash: boolean;
  editing: boolean;
  first: boolean;
  last: boolean;
  onPin: () => void;
  onMove: (by: -1 | 1) => void;
  onMore: () => void;
}) {
  const id = stop.place.id;
  const dim = useAnimatedStyle(() => {
    const a = activeId.get();
    return { opacity: withTiming(a === null || a === id ? 1 : 0.5, { duration: 180 }) };
  });
  // A regenerated or swapped-in stop glows warm for a moment, so the change is visible at a glance.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!flash) return;
    glow.set(1);
    glow.set(withDelay(250, withTiming(0, { duration: 1200 })));
  }, [flash, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  // The row's own press and its buttons are siblings, never nested: a button inside a button is
  // invalid on web and confusing to screen readers everywhere.
  return (
    <Animated.View style={[styles.stop, dim]}>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <PressableScale
        onPress={editing ? onMore : () => router.push({ pathname: '/place/[id]', params: { id } })}
        containerStyle={styles.stopMainSlot}
        style={styles.stopMain}
        accessibilityRole="button"
        accessibilityLabel={`Stop ${number}, ${stop.place.name}, ${formatClock(stop.startMinutes)}`}
      >
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
          {stop.suggested ? (
            <Text variant="micro" color={light.accent}>
              Suggested · local pick
            </Text>
          ) : stop.pinned ? (
            <Text variant="micro">Pinned</Text>
          ) : null}
        </View>
      </PressableScale>

      {editing ? (
          <View style={styles.editTools}>
            <SmallButton icon="chevron-up" label="Move earlier" disabled={first} onPress={() => onMove(-1)} />
            <SmallButton icon="chevron-down" label="Move later" disabled={last} onPress={() => onMove(1)} />
            <SmallButton icon="more-horizontal" label={`More for ${stop.place.name}`} onPress={onMore} />
          </View>
        ) : !stop.suggested ? (
          <SmallButton icon="map-pin" label={stop.pinned ? 'Unpin' : 'Pin'} on={stop.pinned} onPress={onPin} />
        ) : null}
    </Animated.View>
  );
}

function SmallButton({
  icon,
  label,
  on,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  on?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.small, on && styles.smallOn, pressed && styles.smallPressed, disabled && styles.smallDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on, disabled }}
    >
      <Feather name={icon} size={15} color={on ? light.ctaInk : light.ink} />
    </Pressable>
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
  title: { marginTop: 6, marginBottom: 14 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: light.canvas,
    borderWidth: 1,
    borderColor: light.line,
  },
  toolOn: { backgroundColor: light.ink, borderColor: light.ink },
  note: { marginTop: 10 },
  thin: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: light.canvas,
  },
  thinText: { flex: 1 },
  thinLink: { color: light.ink, textDecorationLine: 'underline' },
  days: { marginTop: 18, marginHorizontal: -24 },
  daysContent: { paddingHorizontal: 24, gap: 8 },
  dayTab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: light.canvas,
    borderWidth: 1,
    borderColor: light.line,
  },
  dayTabOn: { backgroundColor: light.ink, borderColor: light.ink },
  list: { marginTop: 6 },
  busy: { opacity: 0.4 },
  daySummary: { marginTop: 14 },
  emptyDay: { marginTop: 14 },
  partHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stopMainSlot: { flex: 1 },
  stopMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glow: { position: 'absolute', left: -10, right: -10, top: 0, bottom: 0, borderRadius: 16, backgroundColor: 'rgba(226,118,60,0.14)' },
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
  editTools: { flexDirection: 'row', gap: 6 },
  small: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvas,
    borderWidth: 1,
    borderColor: light.line,
  },
  smallOn: { backgroundColor: light.ink, borderColor: light.ink },
  smallPressed: { transform: [{ scale: 0.92 }] },
  smallDisabled: { opacity: 0.3 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingVertical: 8 },
  legCompact: { paddingTop: 0 },
  legLine: { width: 2, height: 18, borderRadius: 1, backgroundColor: light.line, marginRight: 4 },
  addOwn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: light.lineStrong,
  },
  left: { marginTop: 28, gap: 12 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leftThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: light.canvasTop },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  floating: { position: 'absolute', left: 20, right: 20, bottom: 0 },
});
