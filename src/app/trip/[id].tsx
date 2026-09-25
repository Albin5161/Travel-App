import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { getCity, getLocalPicks } from '@/data/api';
import {
  addDays,
  formatDay,
  formatRange,
  fromIso,
  isoDay,
  PACE_STOPS,
  rulePlanner,
  weekend,
  type Pace,
  type TripPrefs,
  type When,
} from '@/data/planner';
import { haptic } from '@/lib/haptics';
import type { Getting } from '@/lib/geo';
import { FADE_IN, FADE_OUT, fadeUp, SPRING_SETTLE } from '@/lib/motion';
import { useCityPlaces, useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

type Step = 'when' | 'dates' | 'days' | 'pace' | 'getting' | 'build';
const ADVANCE_MS = 260;
const MAX_DAYS = 7;
const CALENDAR_WEEKS = 4;
const ENTER = [0, 1, 2, 3, 4].map((i) => fadeUp(60 + i * 50));

/**
 * Four quick questions before a plan: when, how long (only if the dates don't say), what pace,
 * and how you're getting around. One per screen, answered with a tap that moves you on, so it
 * feels like a conversation rather than a form. The last step builds the plan in place.
 */
export default function TripSetup() {
  // `from: plan` means Change answers: finishing goes back to that plan instead of stacking a new one.
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const city = getCity(id);
  // Planned from the places not skipped in the place sheet.
  const { kept: collected } = useCityPlaces(id);
  const { state, dispatch } = useTrips();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);

  // Changing answers starts from the ones already given.
  const previous = state.tripPlans[id]?.prefs;
  const [prefs, setPrefs] = useState<TripPrefs>(
    previous ?? { when: 'this-weekend', start: null, days: 2, pace: 'balanced', getting: 'local' },
  );
  const [answered, setAnswered] = useState<Partial<Record<Step, boolean>>>(previous ? { when: true, pace: true, getting: true } : {});
  const [history, setHistory] = useState<Step[]>(['when']);
  const step = history[history.length - 1];

  // The middle question only exists for "Pick dates" and "Not sure yet".
  const middle: Step | null = prefs.when === 'dates' ? 'dates' : prefs.when === 'flexible' ? 'days' : null;
  const sequence: Step[] = ['when', ...(middle ? [middle] : []), 'pace', 'getting'];
  const position = step === 'build' ? sequence.length : sequence.indexOf(step);

  const go = (next: Step) => setHistory((h) => [...h, next]);
  const back = () => {
    if (history.length <= 1) router.back();
    else setHistory((h) => h.slice(0, -1));
  };

  // A tap selects, shows the check for a beat, then moves on.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);
  const answer = (patch: Partial<TripPrefs>, key: Step, next: Step) => {
    haptic.selection();
    setPrefs((p) => ({ ...p, ...patch }));
    setAnswered((a) => ({ ...a, [key]: true }));
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => go(next), ADVANCE_MS);
  };

  const chooseWhen = (when: When) => {
    if (when === 'this-weekend' || when === 'next-weekend') {
      const w = weekend(today, when === 'this-weekend' ? 'this' : 'next');
      answer({ when, start: w.start, days: w.days }, 'when', 'pace');
    } else if (when === 'dates') answer({ when }, 'when', 'dates');
    else answer({ when, start: null }, 'when', 'days');
  };

  if (!city) return null;
  const thisW = weekend(today, 'this');
  const nextW = weekend(today, 'next');

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <IconButton icon={history.length <= 1 ? 'x' : 'chevron-left'} onPress={back} accessibilityLabel={history.length <= 1 ? 'Close' : 'Back'} />
        {step !== 'build' ? <Progress total={sequence.length} at={position} /> : null}
      </View>

      {step === 'build' ? (
        <Build
          cityName={city.name}
          count={collected.length}
          prefs={prefs}
          onBuilt={async () => {
            const plan = await rulePlanner.plan({
              cityId: id,
              saved: collected,
              suggestions: getLocalPicks(id),
              prefs,
              pins: [],
              removed: [],
              seed: 1,
            });
            dispatch({ type: 'setTripPlan', plan });
            if (from === 'plan') router.back();
            else router.replace({ pathname: '/plan/[id]', params: { id } });
          }}
        />
      ) : (
        <Animated.View key={step} entering={FADE_IN} exiting={FADE_OUT} style={styles.body}>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
            <Animated.View entering={ENTER[0]}>
              <Text variant="micro">Plan your trip · {city.name}</Text>
            </Animated.View>
            <Animated.View entering={ENTER[1]}>
              <Text variant="display" style={styles.question}>
                {QUESTION[step]}
              </Text>
            </Animated.View>

            {step === 'when' ? (
              <Options
                selected={answered.when ? prefs.when : null}
                onPick={(k) => chooseWhen(k as When)}
                options={[
                  { key: 'this-weekend', title: 'This weekend', detail: formatRange(thisW.start, thisW.days) },
                  { key: 'next-weekend', title: 'Next weekend', detail: formatRange(nextW.start, nextW.days) },
                  { key: 'dates', title: 'Pick dates', detail: 'Choose the days on a calendar' },
                  { key: 'flexible', title: 'Not sure yet', detail: 'Plan by number of days, dates later' },
                ]}
              />
            ) : null}

            {step === 'days' ? (
              <Options
                selected={answered.days ? String(prefs.days) : null}
                onPick={(k) => answer({ days: Number(k) }, 'days', 'pace')}
                options={[1, 2, 3, 4].map((d) => ({
                  key: String(d),
                  title: d === 4 ? '4 days or more' : `${d} ${d === 1 ? 'day' : 'days'}`,
                  detail: d === 1 ? 'A day trip' : d === 2 ? 'A weekend' : d === 3 ? 'A long weekend' : "We'll plan four; add more after",
                }))}
              />
            ) : null}

            {step === 'dates' ? (
              <Calendar
                today={today}
                start={prefs.start}
                days={prefs.days}
                onChange={(start, days) => setPrefs((p) => ({ ...p, start, days }))}
              />
            ) : null}

            {step === 'pace' ? (
              <Options
                selected={answered.pace ? prefs.pace : null}
                onPick={(k) => answer({ pace: k as Pace }, 'pace', 'getting')}
                options={[
                  { key: 'relaxed', title: 'Relaxed', detail: `${PACE_STOPS.relaxed - 1}–${PACE_STOPS.relaxed} stops a day, late starts` },
                  { key: 'balanced', title: 'Balanced', detail: `About ${PACE_STOPS.balanced} stops a day` },
                  { key: 'packed', title: 'Packed', detail: `${PACE_STOPS.packed - 1}–${PACE_STOPS.packed} stops a day, out by seven` },
                ]}
              />
            ) : null}

            {step === 'getting' ? (
              <Options
                selected={answered.getting ? prefs.getting : null}
                onPick={(k) => answer({ getting: k as Getting }, 'getting', 'build')}
                options={[
                  { key: 'local', title: 'Walking and autos', detail: 'Walk the short hops, auto or cab the rest' },
                  { key: 'drive', title: 'Own vehicle', detail: 'Car or bike, door to door' },
                  { key: 'bus', title: 'Bus', detail: 'Slower, with waits at the stop' },
                ]}
              />
            ) : null}
          </ScrollView>

          {step === 'dates' ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
              <Button
                label={prefs.start ? `Continue with ${formatRange(prefs.start, prefs.days)}` : 'Pick a start day'}
                disabled={!prefs.start}
                onPress={() => {
                  haptic.light();
                  go('pace');
                }}
              />
            </View>
          ) : null}
        </Animated.View>
      )}
    </View>
  );
}

const QUESTION: Record<Exclude<Step, 'build'>, string> = {
  when: 'When are you going?',
  dates: 'Which days?',
  days: 'How many days?',
  pace: 'What pace suits you?',
  getting: 'How are you getting around?',
};

/** One segment per question; the current one fills as you arrive on it. */
function Progress({ total, at }: { total: number; at: number }) {
  return (
    <View style={styles.progress} accessibilityLabel={`Question ${at + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} on={i <= at} />
      ))}
    </View>
  );
}

function Segment({ on }: { on: boolean }) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.set(withTiming(on ? 1 : 0, { duration: 320 }));
  }, [on, v]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: v.get() }] }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

type Option = { key: string; title: string; detail: string };

function Options({ options, selected, onPick }: { options: Option[]; selected: string | null; onPick: (key: string) => void }) {
  return (
    <View style={styles.options}>
      {options.map((o, i) => (
        <Animated.View key={o.key} entering={ENTER[Math.min(i + 1, ENTER.length - 1)]}>
          <OptionRow option={o} on={selected === o.key} onPress={() => onPick(o.key)} />
        </Animated.View>
      ))}
    </View>
  );
}

function OptionRow({ option, on, onPress }: { option: Option; on: boolean; onPress: () => void }) {
  const check = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    check.set(on ? withSpring(1, SPRING_SETTLE) : withTiming(0, { duration: 120 }));
  }, [check, on]);
  const tick = useAnimatedStyle(() => ({ opacity: check.get(), transform: [{ scale: 0.6 + 0.4 * check.get() }] }));
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.optionPressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${option.title}. ${option.detail}`}
    >
      <View style={styles.optionText}>
        <Text variant="title">{option.title}</Text>
        <Text variant="label" color={light.inkSoft}>
          {option.detail}
        </Text>
      </View>
      <Animated.View style={[styles.tick, tick]}>
        <Feather name="check" size={14} color={light.ctaInk} />
      </Animated.View>
    </Pressable>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Four weeks from today. Tap a first day, then a last; tapping again starts over. */
function Calendar({
  today,
  start,
  days,
  onChange,
}: {
  today: Date;
  start: string | null;
  days: number;
  onChange: (start: string | null, days: number) => void;
}) {
  const first = isoDay(today);
  // Weeks start on Sunday: pad the first row so dates sit under their weekday.
  const lead = today.getDay();
  const cells = Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i) => (i < lead ? null : addDays(first, i - lead)));
  const end = start ? addDays(start, days - 1) : null;
  const [picking, setPicking] = useState<'start' | 'end'>(start && days > 1 ? 'start' : start ? 'end' : 'start');

  const tap = (iso: string) => {
    haptic.selection();
    if (picking === 'start' || !start || iso < start) {
      onChange(iso, 1);
      setPicking('end');
    } else {
      const span = Math.round((fromIso(iso).getTime() - fromIso(start).getTime()) / 86400000) + 1;
      onChange(start, Math.min(span, MAX_DAYS));
      setPicking('start');
    }
  };

  return (
    <View style={styles.calendar}>
      <Text variant="label" color={light.inkSoft}>
        {!start ? 'Tap your first day.' : picking === 'end' ? `From ${formatDay(start)}. Tap your last day, or continue with one.` : `Up to ${MAX_DAYS} days.`}
      </Text>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} variant="micro" style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={i} style={styles.cell} />;
          const inRange = !!start && !!end && iso >= start && iso <= end;
          const edge = iso === start || iso === end;
          return (
            <Pressable
              key={iso}
              onPress={() => tap(iso)}
              style={[styles.cell, inRange && styles.cellRange, edge && styles.cellEdge]}
              accessibilityRole="button"
              accessibilityState={{ selected: inRange }}
              accessibilityLabel={formatDay(iso)}
            >
              <Text variant="data" color={edge ? light.ctaInk : iso === first ? light.accent : light.ink}>
                {fromIso(iso).getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The plan being built, step by step, then handed to the plan screen. */
function Build({ cityName, count, prefs, onBuilt }: { cityName: string; count: number; prefs: TripPrefs; onBuilt: () => void }) {
  const lines = [
    `Grouping your ${count} ${count === 1 ? 'spot' : 'spots'} by area`,
    `Fitting them into ${prefs.days} ${prefs.days === 1 ? 'day' : 'days'} at a ${prefs.pace} pace`,
    prefs.getting === 'drive' ? 'Timing the drives between them' : prefs.getting === 'bus' ? 'Timing the buses between them' : 'Timing the walks and autos between them',
    'Looking for a good dinner nearby',
  ];
  const [done, setDone] = useState(0);
  const handed = useRef(false);
  // Held in a ref: the parent passes a new function each render, and the hand-off timer must not be
  // cleared by one.
  const built = useRef(onBuilt);
  useEffect(() => {
    built.current = onBuilt;
  });
  useEffect(() => {
    if (done < lines.length) {
      const t = setTimeout(() => {
        haptic.selection();
        setDone((n) => n + 1);
      }, done === 0 ? 400 : 480);
      return () => clearTimeout(t);
    }
    if (handed.current) return;
    handed.current = true;
    haptic.success();
    setTimeout(() => built.current(), 350);
  }, [done, lines.length]);

  return (
    <View style={styles.build}>
      <Text variant="micro">Plan your trip · {cityName}</Text>
      <Text variant="display" style={styles.question}>
        Building your plan
      </Text>
      <View style={styles.buildLines}>
        {lines.map((line, i) =>
          i <= done ? (
            <Animated.View key={line} entering={FADE_IN} style={styles.buildLine}>
              <View style={[styles.buildDot, i < done && styles.buildDotDone]}>
                {i < done ? <Feather name="check" size={11} color={light.ctaInk} /> : null}
              </View>
              <Text variant="body" color={i < done ? light.ink : light.inkSoft}>
                {line}
                {i === done ? '…' : ''}
              </Text>
            </Animated.View>
          ) : null,
        )}
      </View>
    </View>
  );
}

const CELL = 44;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16 },
  progress: { flex: 1, flexDirection: 'row', gap: 6, paddingRight: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: light.line, overflow: 'hidden' },
  segmentFill: { ...StyleSheet.absoluteFill, backgroundColor: light.ink, transformOrigin: 'left' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  question: { marginTop: 6, marginBottom: 22 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: light.panel,
    borderWidth: 1.5,
    borderColor: light.line,
  },
  optionOn: { borderColor: light.ink },
  optionPressed: { transform: [{ scale: 0.985 }] },
  optionText: { flex: 1, gap: 2 },
  tick: { width: 24, height: 24, borderRadius: 12, backgroundColor: light.ink, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  calendar: { gap: 14 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { width: CELL, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  cell: { width: CELL, height: CELL, borderRadius: CELL / 2, alignItems: 'center', justifyContent: 'center' },
  cellRange: { backgroundColor: light.canvasTop },
  cellEdge: { backgroundColor: light.ink },
  build: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  buildLines: { gap: 16 },
  buildLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buildDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: light.lineStrong, alignItems: 'center', justifyContent: 'center' },
  buildDotDone: { backgroundColor: light.ink, borderColor: light.ink },
});
