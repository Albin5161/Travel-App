import Feather from '@expo/vector-icons/Feather';
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
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/Button';
import { CityMap, fitCameraToRect, flyTo, glideTo, untilt, useCamera } from '@/components/CityMap';
import { IconButton } from '@/components/IconButton';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { PassportStamp } from '@/components/motion/PassportStamp';
import { usePlanPdf } from '@/components/share/usePlanPdf';
import { StopActions } from '@/components/plan/StopActions';
import { costLabel, typeLine } from '@/components/PlaceMeta';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { GoogleMap, type GoogleMapProps } from '@/components/GoogleMap';
import { getCity, getLocalPicks, isLiveCity } from '@/data/api';
import {
  addStop,
  changedStops,
  formatDay,
  formatRange,
  fromIso,
  moveToDay,
  partOf,
  pinsOf,
  planNow,
  removeStop,
  reorder,
  rulePlanner,
  swapStop,
  togglePin,
  type TripPlan,
  type TripStop,
} from '@/data/planner';
import type { DayPart, Place } from '@/data/types';
import { prebake, uriOf } from '@/lib/blur';
import { formatClock, formatDuration, smoothPath, smoothPathStops } from '@/lib/geo';
import { whyDay, whyStop, type Reason } from '@/data/why';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { EASE_IN_OUT, FADE_IN, FADE_OUT, fadeUp, REFLOW } from '@/lib/motion';
import { customStops } from '@/data/custom';
import { usePlanWriter } from '@/state/live';
import { useHomeSky } from '@/state/sky';
import { useCityPlaces, useTrips } from '@/state/trips';
import { deepGlass, SKY, skyAccent, skyAccentText, skyAccentWash, skyCta, skyFill, skyInk, withAlpha } from '@/theme/sky';
import { Tone } from '@/theme/tone';
import { colors, fonts, radii, space } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const PART_TITLE: Record<DayPart, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
/** A trip's longest: the planning questions offer up to a week too. */
const MAX_DAYS = 7;

const PACE_LABEL = { relaxed: 'Relaxed', balanced: 'Balanced', packed: 'Packed' } as const;
const GETTING_LABEL = { local: 'Walking and autos', drive: 'Own vehicle', bus: 'By bus' } as const;
const ROW_ENTER = fadeUp(0);
const READING_LINE = 150;
// How far the painted map lays back while it follows the plan: a look ahead, not a plunge.
const JOURNEY_TILT = 40;
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
  // The bottom fade melts the list into the sky behind the page.
  const look = SKY[useHomeSky()];
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
  // A removed stop can be put back for a few seconds: the plan as it was, and what to say.
  const [undo, setUndo] = useState<{ plan: TripPlan; label: string } | null>(null);
  const pdf = usePlanPdf(city, plan);
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
  // Which stop the plan is on as it's scrolled, -1 before the first: the map follows it, the route
  // and the stop numbers light up to it.
  const activeIdx = useSharedValue(-1);

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
    activeIdx.set(-1);
    flyTo(camera, fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Scroll-synced camera, the way a run's map follows it: at the top the whole day, flat; once the
  // plan moves, the map lays back and lands on the first stop, then glides on as each stop crosses
  // the reading line.
  const scrollY = useSharedValue(0);
  const rowYs = useSharedValue<number[]>([]);
  // Rows measure themselves from the top of the list, which sits below the title and tools.
  const listY = useSharedValue(0);
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
      const line = y + READING_LINE - listY.get();
      const ys = rowYs.get();
      let idx = 0;
      for (let i = 0; i < ys.length; i++) if (ys[i] !== undefined && ys[i] <= line) idx = i;
      return idx;
    },
    (idx, prev) => {
      if (idx === prev) return;
      if (idx < 0 || idx >= points.length) {
        activeId.set(null);
        activeIdx.set(-1);
        flyTo(camera, fit, 600);
        return;
      }
      activeId.set(stopIds[idx]);
      activeIdx.set(idx);
      const [px, py] = points[idx];
      // The stop lands in the middle of the part of the map no panel covers, tilt and all.
      glideTo(
        camera,
        { x: px, y: py - untilt(visibleCy - MAP_H / 2, JOURNEY_TILT) / focusScale, s: focusScale, t: JOURNEY_TILT },
        { w: W, h: MAP_H },
      );
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
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);

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
  // What the ticket needs is fetched while the stamp lands, so it's there as the stamp lifts: the
  // share screen's code (the web loads each screen on first use), the city's photo and its blur.
  const save = () => {
    setStamping(true);
    void import('../share/[id]').catch(() => {});
    if (!city) return;
    prebake(city.hero);
    const photo = uriOf(city.hero);
    if (photo) void Image.prefetch(photo).catch(() => {});
  };
  const saved = () => {
    dispatch({ type: 'saveTrip', cityId: id });
    track('trip planned', { days: plan.days.length });
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
  // One more day, worked out before it's offered: how many of the places the planner couldn't fit
  // it would really take. Some may be too far for any day; places taken out by hand don't count.
  const unfit = left.filter((p) => !plan.removed.includes(p.id));
  const bigger =
    unfit.length > 0 && n < MAX_DAYS
      ? planNow({
          cityId: id,
          saved: [...collected, ...customStops(plan).map((c) => c.place)],
          suggestions: locals,
          prefs: { ...prefs, days: n + 1 },
          pins: pinsOf(plan),
          removed: plan.removed,
          seed: plan.seed,
        })
      : null;
  const gain = bigger ? bigger.days.reduce((sum, d) => sum + d.stops.filter((s) => !s.suggested).length, 0) - placed : 0;
  const addDay = () => {
    if (!bigger) return;
    haptic.success();
    const changed = changedStops(plan, bigger);
    update(bigger);
    setFlash(changed);
    setDay(n);
  };

  return (
    <SkyScreen>
      {/* The map is paper: it keeps the paper palette, route and labels. */}
      <Tone value="light">
      <View style={{ height: MAP_H }}>
        {isLiveCity(city.id) ? (
          <LiveJourneyMap
            activeId={activeId}
            pins={stops.map((s, i) => ({
              id: s.place.id,
              name: s.place.name,
              coords: s.place.coords,
              photo: s.place.photo,
              number: i + 1,
            }))}
            width={W}
            height={MAP_H}
            route
            padding={{ top: insets.top + 60, bottom: 40 }}
            onPinPress={(pid) => router.push({ pathname: '/place/[id]', params: { id: pid } })}
          />
        ) : (
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
                <Route
                  key={routeKey}
                  d={smoothPath(points)}
                  stops={smoothPathStops(points)}
                  progress={progress}
                  activeIdx={activeIdx}
                  width={3 / fit.s}
                />
              ) : null
            }
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(4,10,30,0.5)', 'rgba(4,10,30,0)']}
          style={[styles.topFade, { height: insets.top + 80 }]}
        />
      </View>
      </Tone>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
      </View>

      {/* Deep glass: its top edge lies over the pale map, where light glass would wash out the type. */}
      <Glass blur tint={deepGlass(look)} radius={radii.sheet} style={styles.panel}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 24, paddingBottom: insets.bottom + 130 }}
        >
          <Text variant="eyebrow" numberOfLines={2}>
            {meta}
          </Text>
          <Text variant="display" accessibilityRole="header" style={styles.title}>
            {n === 1 ? `Your day in ${city.name}` : `Your ${n} days in ${city.name}`}
          </Text>

          <View style={styles.tools}>
            <Tool icon={editing ? 'check' : 'edit-2'} label={editing ? 'Done' : 'Edit'} on={editing} onPress={() => setEditing((e) => !e)} />
            <Tool icon="refresh-cw" label={busy ? 'Shuffling…' : 'Reshuffle'} a11y="Reshuffle the plan" onPress={regenerate} />
            <Tool
              icon="sliders"
              label="Adjust"
              a11y="Change your answers"
              onPress={() => router.push({ pathname: '/trip/[id]', params: { id, from: 'plan' } })}
            />
          </View>
          {note ? (
            <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
              <Text variant="label" color={skyInk.soft} style={styles.note}>
                {note}
              </Text>
            </Animated.View>
          ) : (
            <Text variant="label" color={skyInk.faint} style={styles.note}>
              {editing ? 'Move stops with the arrows. Tap ⋯ to lock one in place, swap or remove it.' : 'Love a stop? Tap Edit to lock it. Reshuffle keeps locked stops and changes the rest.'}
            </Text>
          )}

          {emptyDays > 0 && n > 1 ? (
            <View style={styles.thin}>
              <Feather name="info" size={14} color={skyInk.soft} />
              <Text variant="label" color={skyInk.soft} style={styles.thinText}>
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
                    <Text variant="label" color={on ? skyCta : skyInk.strong}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={[styles.list, busy && styles.busy]} onLayout={(e) => listY.set(e.nativeEvent.layout.y)}>
            <Text variant="data" style={styles.daySummary}>
              {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
              {today.totalKm > 0 ? ` · ${today.totalKm.toFixed(1)} km` : ''}
            </Text>
            <WhyCard reasons={whyDay(plan, dayIndex)} />

            {stops.length === 0 ? (
              <Text variant="body" style={styles.emptyDay}>
                Nothing planned this day. Add a saved spot below, move one here, or reshuffle.
              </Text>
            ) : null}

            {/* Flat children so each row's onLayout y is relative to the list; listY adds the rest. */}
            {parts.flatMap((part) => [
              <Animated.View key={`h-${part.part}-${part.stops[0].i}`} layout={REFLOW} style={styles.partHeader}>
                <Text variant="headline" accessibilityRole="header">{PART_TITLE[part.part]}</Text>
                <Text variant="data">{formatClock(part.stops[0].stop.startMinutes)}</Text>
              </Animated.View>,
              ...part.stops.map(({ stop, i }, j) => (
                <Animated.View
                  key={stop.place.id}
                  entering={ROW_ENTER}
                  layout={REFLOW}
                  onLayout={(e) => setRowY(i, e.nativeEvent.layout.y)}
                >
                  {stop.legBefore ? (
                    <Leg
                      leg={stop.legBefore}
                      compact={j === 0}
                      from={i === 0 ? plan.prefs.stay?.name : undefined}
                      index={i}
                      activeIdx={activeIdx}
                    />
                  ) : null}
                  <StopRow
                    stop={stop}
                    why={whyStop(plan, dayIndex, i)}
                    number={i + 1}
                    index={i}
                    activeId={activeId}
                    activeIdx={activeIdx}
                    flash={flash.has(stop.place.id)}
                    editing={editing}
                    first={i === 0}
                    last={i === stops.length - 1}
                    onMove={(by) => {
                      haptic.selection();
                      update(reorder(plan, dayIndex, stop.place.id, by));
                    }}
                    onMore={() => setSheet(stop)}
                  />
                </Animated.View>
              )),
            ])}

            {today.home && stops.length > 0 ? <Leg leg={today.home} to={plan.prefs.stay?.name} /> : null}

            <PressableScale
              onPress={() => router.push({ pathname: '/addstop/[id]', params: { id, day: String(dayIndex) } })}
              style={styles.addOwn}
              accessibilityRole="button"
              accessibilityLabel="Add your own stop"
            >
              <Feather name="plus" size={16} color={skyInk.strong} />
              <Text variant="label">Add your own stop</Text>
            </PressableScale>

            {left.length > 0 ? (
              <View style={styles.left}>
                <Text variant="micro">Not in this plan · {left.length}</Text>
                {unfit.some((p) => !plan.leftWhy?.[p.id]) ? (
                  <Text variant="label" color={skyInk.soft}>
                    {`The days are full at a ${prefs.pace} pace.${gain > 0 ? '' : ' Pick a faster pace, or take a stop out to make room.'}`}
                  </Text>
                ) : null}
                {gain > 0 ? (
                  <Button
                    kind="secondary"
                    label={
                      gain >= unfit.length
                        ? `Add a day for ${unfit.length === 1 ? 'it' : `these ${unfit.length}`}`
                        : `Add a day: fits ${gain} of these ${unfit.length}`
                    }
                    onPress={addDay}
                  />
                ) : null}
                {left.map((p) => (
                  <Animated.View key={p.id} entering={ROW_ENTER} exiting={FADE_OUT} layout={REFLOW} style={styles.leftRow}>
                    <Image source={p.photo} style={styles.leftThumb} contentFit="cover" transition={0} />
                    <View style={styles.stopText}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {p.name}
                      </Text>
                      {/* Why the planner left it out, when it did: too far, or the days are full. */}
                      <Text variant="label" color={skyInk.soft} numberOfLines={plan.leftWhy?.[p.id] ? 4 : 1}>
                        {plan.leftWhy?.[p.id] ?? typeLine(p)}
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

            <Text variant="label" color={skyInk.soft} style={styles.aiNote}>
              Places found by AI from videos; times and drives are estimates. It can make mistakes, so check
              before you go.
            </Text>
            {/* A copy to keep: every day, its reasons and its stops, to print or open offline. */}
            {pdf.available ? (
              <Button
                kind="secondary"
                compact
                label={pdf.making ? 'Making the PDF…' : 'Download as PDF'}
                onPress={async () => {
                  const result = await pdf.save();
                  if (result === 'failed') setNote('Couldn’t make the PDF. Try again?');
                  else if (result === 'downloaded') setNote('PDF saved to your downloads.');
                }}
                style={styles.pdf}
                accessibilityHint="A printable copy of every day, to keep for the trip"
              />
            ) : null}
          </View>
        </Animated.ScrollView>

        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(look.stops[2], 0), withAlpha(look.stops[2], 0.92)]}
          style={[styles.bottomFade, { height: insets.bottom + 110 }]}
        />
        <View style={[styles.floating, { paddingBottom: insets.bottom + 16 }]}>
          {undo ? (
            <Animated.View entering={FADE_IN} exiting={FADE_OUT} style={styles.undo}>
              <Text variant="label" color={skyInk.strong} numberOfLines={1} style={styles.undoText}>
                {undo.label}
              </Text>
              <PressableScale
                onPress={() => {
                  haptic.selection();
                  update(undo.plan);
                  setUndo(null);
                }}
                containerStyle={styles.undoTap}
                accessibilityRole="button"
                accessibilityLabel={`Undo: ${undo.label}`}
              >
                <Text variant="label" color={skyInk.strong} style={styles.undoAction}>
                  Undo
                </Text>
              </PressableScale>
            </Animated.View>
          ) : null}
          <Button
            trailingArrow
            label={n === 1 ? 'Save this day' : `Save this ${n}-day plan`}
            onPress={save}
            disabled={plan.days.every((d) => d.stops.length === 0) || stamping || busy}
          />
        </View>
      </Glass>

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
          setUndo({ plan, label: `Removed ${sheet.place.name}` });
          update(removeStop(plan, dayIndex, sheet.place.id));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      {stamping ? (
        <PassportStamp city={city.name} date={today.date ? fromIso(plan.days[0].date ?? today.date) : new Date()} onDone={saved} />
      ) : null}
    </SkyScreen>
  );
}

// Three equal buttons on one line: short labels, the full meaning for screen readers.
function Tool({
  icon,
  label,
  a11y,
  on,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  a11y?: string;
  on?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} containerStyle={styles.toolSlot} accessibilityRole="button" accessibilityLabel={a11y ?? label}>
      <View style={[styles.tool, on && styles.toolOn]}>
        <Feather name={icon} size={13} color={on ? skyCta : skyInk.strong} />
        <Text variant="label" color={on ? skyCta : skyInk.strong} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/** The day's route drawing itself in, and over it in ember, the way so far to the stop the plan is on. */
function Route({
  d,
  stops,
  progress,
  activeIdx,
  width,
}: {
  d: string;
  stops: number[];
  progress: SharedValue<number>;
  activeIdx: SharedValue<number>;
  width: number;
}) {
  const length = stops[stops.length - 1] ?? 0;
  const drawn = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.get()) }));
  const reached = useSharedValue(0);
  useAnimatedReaction(
    () => activeIdx.get(),
    (i) => {
      reached.set(withTiming(i > 0 ? stops[Math.min(i, stops.length - 1)] : 0, { duration: 700, easing: EASE_IN_OUT }));
    },
  );
  const travelled = useAnimatedProps(() => ({ strokeDashoffset: length - reached.get() }));
  return (
    <>
      <AnimatedPath
        d={d}
        fill="none"
        stroke={PAPER_INK}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[length, length]}
        animatedProps={drawn}
      />
      <AnimatedPath
        d={d}
        fill="none"
        stroke={colors.ember}
        strokeWidth={width * 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[length, length]}
        animatedProps={travelled}
      />
    </>
  );
}

/**
 * The Google map for a real city, following the plan. It hears which stop the plan is on from the
 * scroll, and only it re-renders when that changes, not the whole plan.
 */
function LiveJourneyMap({ activeId, ...props }: GoogleMapProps & { activeId: SharedValue<string | null> }) {
  const [focus, setFocus] = useState<string | null>(null);
  useAnimatedReaction(
    () => activeId.get(),
    (id, prev) => {
      if (id !== prev) scheduleOnRN(setFocus, id);
    },
  );
  return <GoogleMap {...props} focusId={focus} />;
}

/** A drive or walk between stops; the day's first one says where from, the last one where back to. */
function Leg({
  leg,
  compact,
  from,
  to,
  index,
  activeIdx,
}: {
  leg: NonNullable<TripStop['legBefore']>;
  compact?: boolean;
  from?: string;
  to?: string;
  /** The stop this leg leads to: once the plan reaches it, the leg is travelled and turns ember. */
  index?: number;
  activeIdx?: SharedValue<number>;
}) {
  const travelled = useAnimatedStyle(() => {
    const on = activeIdx && index !== undefined && index > 0 && activeIdx.get() >= index;
    return { transform: [{ scaleY: withTiming(on ? 1 : 0, { duration: 400, easing: EASE_IN_OUT }) }] };
  });
  const how =
    leg.mode === 'walk'
      ? `${leg.minutes} min walk · ${leg.km.toFixed(1)} km`
      : `${formatDuration(leg.minutes)} by ${leg.mode} · ${leg.km.toFixed(1)} km`;
  const label = from ? `${how} from ${from}` : to ? `Back to ${to} · ${how}` : how;
  return (
    <View style={[styles.leg, compact && styles.legCompact]}>
      <View style={styles.legLine}>
        <Animated.View style={[styles.legLineOn, travelled]} />
      </View>
      <Feather name={leg.mode === 'walk' ? 'navigation' : 'truck'} size={12} color={skyInk.faint} />
      <Text variant="data">{label}</Text>
    </View>
  );
}

/** Why the day is arranged as it is: the planner's reasons, a line each, lead in bold. */
function WhyCard({ reasons }: { reasons: Reason[] }) {
  if (reasons.length === 0) return null;
  return (
    <View style={styles.why}>
      <View style={styles.whyHead}>
        <Feather name="compass" size={13} color={skyAccentText} />
        <Text variant="eyebrow" color={skyAccentText} accessibilityRole="header">
          Why this day works
        </Text>
      </View>
      {reasons.map((r) => (
        <View key={r.lead} style={styles.whyRow}>
          <Feather name="check" size={13} color={skyInk.soft} style={styles.whyTick} />
          <Text variant="label" color={skyInk.soft} style={styles.whyText}>
            <Text variant="label">{r.lead}. </Text>
            {r.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StopRow({
  stop,
  why,
  number,
  index,
  activeId,
  activeIdx,
  flash,
  editing,
  first,
  last,
  onMove,
  onMore,
}: {
  stop: TripStop;
  why: string | null;
  number: number;
  index: number;
  activeId: SharedValue<string | null>;
  activeIdx: SharedValue<number>;
  flash: boolean;
  editing: boolean;
  first: boolean;
  last: boolean;
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
  // Progress through the day: stops the plan has reached fill ember; the one it's on wears a ring.
  const reached = useAnimatedStyle(() => ({
    opacity: withTiming(activeIdx.get() >= index ? 1 : 0, { duration: 300 }),
  }));
  const here = useAnimatedStyle(() => {
    const on = activeIdx.get() === index;
    return {
      opacity: withTiming(on ? 1 : 0, { duration: 300 }),
      transform: [{ scale: withTiming(on ? 1 : 0.7, { duration: 300, easing: EASE_IN_OUT }) }],
    };
  });

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
          <Animated.View style={[styles.stopRing, here]} />
          <Animated.View style={[styles.stopReached, reached]} />
          <Text style={styles.stopNumberText}>{number}</Text>
        </View>
        <Image source={stop.place.photo} style={styles.thumb} contentFit="cover" transition={0} />
        <View style={styles.stopText}>
          <View style={styles.nameRow}>
            {stop.pinned ? <Feather name="lock" size={12} color={skyInk.soft} accessibilityLabel="Locked" /> : null}
            <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {stop.place.name}
            </Text>
          </View>
          <Text variant="data" numberOfLines={1}>
            {[formatClock(stop.startMinutes), formatDuration(stop.place.minutes), costLabel(stop.place.cost)].filter(Boolean).join(' · ')}
          </Text>
          {/* Why it's here, now: the plan's own reasoning, so it never reads as a random list. */}
          {why ? (
            <Text variant="label" color={skyInk.faint} numberOfLines={2} style={styles.stopWhy}>
              {stop.suggested ? <Text variant="label" color={skyAccentText}>Suggested · </Text> : null}
              {why}
            </Text>
          ) : stop.suggested ? (
            <Text variant="micro" color={skyAccentText}>
              Suggested · local pick
            </Text>
          ) : null}
        </View>
      </PressableScale>

      {editing ? (
          <View style={styles.editTools}>
            <SmallButton icon="chevron-up" label="Move earlier" disabled={first} onPress={() => onMove(-1)} />
            <SmallButton icon="chevron-down" label="Move later" disabled={last} onPress={() => onMove(1)} />
            <SmallButton icon="more-horizontal" label={`More for ${stop.place.name}`} onPress={onMore} />
          </View>
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
      <Feather name={icon} size={15} color={on ? skyCta : skyInk.strong} />
    </Pressable>
  );
}

// The route is drawn on the paper map, so it stays paper ink whatever the screen around it.
const PAPER_INK = '#111111';

const styles = StyleSheet.create({
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  topBar: { position: 'absolute', left: space.screen, top: 0 },
  panel: {
    flex: 1,
    marginTop: -28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  title: { marginTop: 6, marginBottom: 14 },
  tools: { flexDirection: 'row', gap: 8 },
  toolSlot: { flex: 1 },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: skyFill.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  toolOn: { backgroundColor: skyInk.strong, borderColor: skyInk.strong },
  note: { marginTop: 10 },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    maxWidth: '100%',
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(4,10,30,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  undoText: { flexShrink: 1 },
  undoTap: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 10 },
  undoAction: { textDecorationLine: 'underline' },
  thin: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: radii.pane,
    backgroundColor: skyFill.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.line,
  },
  thinText: { flex: 1 },
  thinLink: { color: skyInk.strong, textDecorationLine: 'underline' },
  days: { marginTop: 18, marginHorizontal: -space.screen },
  daysContent: { paddingHorizontal: space.screen, gap: 8 },
  // The same pill as the sky's chips: frosted until chosen, then solid white.
  dayTab: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: skyFill.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  dayTabOn: { backgroundColor: skyInk.strong, borderColor: skyInk.strong },
  list: { marginTop: 6 },
  busy: { opacity: 0.4 },
  daySummary: { marginTop: 14 },
  why: {
    marginTop: 12,
    padding: 14,
    gap: 10,
    borderRadius: radii.pane,
    backgroundColor: skyFill.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.line,
  },
  whyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whyRow: { flexDirection: 'row', gap: 10 },
  whyTick: { marginTop: 3 },
  whyText: { flex: 1 },
  stopWhy: { marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1 },
  emptyDay: { marginTop: 14 },
  partHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stopMainSlot: { flex: 1 },
  stopMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glow: { position: 'absolute', left: -10, right: -10, top: 0, bottom: 0, borderRadius: radii.pane, backgroundColor: skyAccentWash },
  stopNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: skyInk.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopReached: { ...StyleSheet.absoluteFill, borderRadius: 12, backgroundColor: skyAccent },
  stopRing: { position: 'absolute', left: -5, top: -5, right: -5, bottom: -5, borderRadius: 17, borderWidth: 2, borderColor: skyAccent },
  stopNumberText: { fontFamily: fonts.sansSemi, fontSize: 12, color: skyCta, fontVariant: ['tabular-nums'] },
  thumb: { width: 56, height: 56, borderRadius: radii.thumb, backgroundColor: skyFill.pane },
  stopText: { flex: 1, gap: 2 },
  editTools: { flexDirection: 'row', gap: 6 },
  small: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyFill.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.rim,
  },
  smallOn: { backgroundColor: skyInk.strong, borderColor: skyInk.strong },
  smallPressed: { transform: [{ scale: 0.92 }] },
  smallDisabled: { opacity: 0.3 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingVertical: 8 },
  legCompact: { paddingTop: 0 },
  legLine: { width: 2, height: 18, borderRadius: 1, backgroundColor: skyInk.line, marginRight: 4, overflow: 'hidden' },
  legLineOn: { ...StyleSheet.absoluteFill, backgroundColor: skyAccent, transformOrigin: 'top' },
  // Quiet small print at the foot of the plan, clear of the floating Save button.
  aiNote: { marginTop: 24, textAlign: 'center' },
  pdf: { alignSelf: 'center', marginTop: 16 },
  addOwn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: skyInk.outline,
  },
  left: { marginTop: 28, gap: 12 },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leftThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: skyFill.pane },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  floating: { position: 'absolute', left: space.screen, right: space.screen, bottom: 0 },
});
