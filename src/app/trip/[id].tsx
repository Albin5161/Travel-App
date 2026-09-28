import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { TICK } from '@/components/sky/Tick';
import { Text } from '@/components/Text';
import { getCity, getLocalPicks } from '@/data/api';
import { customStops } from '@/data/custom';
import {
  addDays,
  formatDay,
  formatRange,
  fromIso,
  isoDay,
  daysNeeded,
  PACE_HOURS,
  PACE_STOPS,
  placesThatFit,
  rulePlanner,
  weekend,
  type Pace,
  type Party,
  type TripPrefs,
  type When,
} from '@/data/planner';
import { haptic } from '@/lib/haptics';
import { findStay } from '@/lib/extract';
import { terrainOf, type Getting, type LatLng } from '@/lib/geo';
import { FADE_IN, FADE_OUT, fadeUp, SPRING_SETTLE } from '@/lib/motion';
import { isNearHome, useCityPlaces, useTrips } from '@/state/trips';
import { skyAccent, skyAccentRim, skyAccentText, skyAccentWash, skyCta, skyFill, skyInk } from '@/theme/sky';
import { radii, space } from '@/theme/tokens';

type Step = 'who' | 'when' | 'dates' | 'days' | 'pace' | 'getting' | 'stay' | 'build';
const STEPS: Step[] = ['who', 'when', 'dates', 'days', 'pace', 'getting', 'stay'];
const ADVANCE_MS = 260;
const MAX_DAYS = 7;
/** How far ahead dates can be picked: this month and the next six. */
const MONTHS_AHEAD = 6;
const ENTER = [0, 1, 2, 3, 4].map((i) => fadeUp(60 + i * 50));

/**
 * Quick questions before a plan: who's going, when, how long (only if the dates don't say), what
 * pace, how you're getting around, and where you're staying. Who's going decides whether sharing the
 * plan starts a vote, and who's in it. One per screen, answered with a tap that moves you on, so it
 * feels like a conversation rather than a form. The last step builds the plan in place.
 *
 * Only the questions that change the plan are asked. One place has nothing to fit or pace, so it
 * goes straight to a plan for this Saturday (Change answers is on the plan). Near home, you sleep at
 * home, so where you're staying isn't asked.
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
  const nearHome = isNearHome(state.collections[id]?.placeIds ?? [], state.homeDistrictId);
  // A single place, planned for the first time: no questions, a day out this weekend.
  const [single] = useState(() => !from && !state.tripPlans[id] && collected.length === 1);

  // Changing answers starts from the ones already given.
  const previous = state.tripPlans[id]?.prefs;
  // Questions left part-way (the app closed, or you stepped out) pick up where they stopped.
  const saved = !previous && state.draft?.stage === 'questions' && state.draft.cityId === id ? state.draft : null;
  const [prefs, setPrefs] = useState<TripPrefs>(
    previous ??
      (single
        ? { party: 'friends', when: 'this-weekend', start: weekend(today, 'this').start, days: 1, pace: 'balanced', getting: nearHome ? 'drive' : 'local' }
        : null) ??
      saved?.prefs ?? { party: 'friends', when: 'this-weekend', start: null, days: 2, pace: 'balanced', getting: 'local' },
  );
  const [answered, setAnswered] = useState<Partial<Record<Step, boolean>>>(
    previous
      ? { who: !!previous.party, when: true, pace: true, getting: true, stay: previous.stay !== undefined }
      : (saved?.answered ?? {}),
  );
  // "In town" is looked up when the plan is built; a stay found before is kept while it's fresh.
  // Near home there's no stay to keep, even one chosen before this counted as near home.
  const [stayInTown, setStayInTown] = useState(!nearHome && (!!previous?.stay || !!saved?.stayInTown));
  // Never resumed onto the build step itself: that one runs when the last answer is given.
  const [history, setHistory] = useState<Step[]>(() => {
    if (single) return ['build'];
    // Nor onto a question this trip no longer asks: near home has no stay.
    const kept = (saved?.history ?? []).filter(
      (h): h is Step => h !== 'build' && STEPS.includes(h as Step) && !(nearHome && h === 'stay'),
    );
    return kept.length ? kept : ['who'];
  });
  const step = history[history.length - 1];

  // The middle question only exists for "Pick dates" and "Not sure yet".
  const middle: Step | null = prefs.when === 'dates' ? 'dates' : prefs.when === 'flexible' ? 'days' : null;
  const sequence: Step[] = ['who', 'when', ...(middle ? [middle] : []), 'pace', 'getting', ...(nearHome ? [] : ['stay' as Step])];
  const position = step === 'build' ? sequence.length : sequence.indexOf(step);

  // Each answer is kept as it's given, so closing the app loses nothing. Opening the questions and
  // leaving before answering one isn't planning left half-done, and changing the answers of a plan
  // that exists already isn't a draft either: that plan is still there.
  useEffect(() => {
    if (previous || !city || Object.keys(answered).length === 0) return;
    dispatch({
      type: 'setDraft',
      draft: { stage: 'questions', cityId: id, prefs, answered, history, stayInTown, at: Date.now() },
    });
    // The plan's own prefs appearing (once built) ends the draft there, in the reducer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, answered, history, stayInTown]);

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

  // Family trips start from a relaxed pace, unless a pace was already chosen.
  const chooseWho = (party: Party) =>
    answer({ party, ...(answered.pace ? {} : { pace: party === 'family' ? 'relaxed' : 'balanced' }) }, 'who', 'when');

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
  // How many days these places need, and how many fit each pace, said before anything is chosen:
  // eleven places won't fit two relaxed days, and that's better heard here than found in the plan.
  const terrain = city.terrain ?? terrainOf(collected.map((p) => p.coords));
  const count = collected.length;
  const needed = daysNeeded(collected, terrain, 'balanced', prefs.getting);
  const fitting = (pace: Pace) => placesThatFit(collected, { ...prefs, pace, terrain, stay: null });
  const fitLine = (pace: Pace) => {
    if (count < 2) return '';
    const k = fitting(pace);
    return k >= count ? ` · fits all ${count} places` : ` · fits ${k} of your ${count}`;
  };
  const hint =
    count < 2
      ? null
      : needed <= 1
        ? `Your ${count} places fit in a day.`
        : `Your ${count} places need about ${needed} days at a balanced pace.`;
  // The hint belongs to the question: close under it, with the question's usual room before the answers.
  const showHint = !!hint && (step === 'when' || step === 'days' || step === 'dates');
  // The fewest days that fit everything, marked on the days question; past four, "4 or more".
  const suggested = Math.min(Math.max(needed, 1), 4);

  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
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
            // New answers rebuild the plan; stops people typed in stay, on their day where it still exists.
            const custom = customStops(state.tripPlans[id]);
            const points = collected.map((p) => p.coords);
            const kept = freshStay(previous?.stay);
            const stay = stayInTown ? (kept ?? (await findStay(`${city.name}, ${city.state}`, centre(points)))) : null;
            const plan = await rulePlanner.plan({
              cityId: id,
              saved: [...collected, ...custom.map((c) => c.place)],
              suggestions: getLocalPicks(id),
              prefs: { ...prefs, terrain, stay },
              pins: custom.map((c) => ({ placeId: c.place.id, day: Math.min(c.day, prefs.days - 1) })),
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
              <Text variant="eyebrow">Plan your trip · {city.name}</Text>
            </Animated.View>
            <Animated.View entering={ENTER[1]}>
              <Text variant="display" accessibilityRole="header" style={[styles.question, showHint && styles.questionWithHint]}>
                {QUESTION[step]}
              </Text>
            </Animated.View>
            {showHint ? (
              <Animated.View entering={ENTER[1]}>
                <Text variant="body" style={styles.hint}>
                  {hint}
                </Text>
              </Animated.View>
            ) : null}

            {step === 'who' ? (
              <Options
                selected={answered.who ? (prefs.party ?? null) : null}
                onPick={(k) => chooseWho(k as Party)}
                options={[
                  { key: 'solo', title: 'Just me', detail: 'Plan it your way' },
                  { key: 'partner', title: 'With my partner', detail: 'You both get a say' },
                  { key: 'friends', title: 'With friends', detail: 'Share it, and the group votes' },
                  { key: 'family', title: 'With family', detail: 'Everyone votes, even Appa' },
                ]}
              />
            ) : null}

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
                  detail:
                    (d === 1 ? 'A day trip' : d === 2 ? 'A weekend' : d === 3 ? 'A long weekend' : "We'll plan four; add more after") +
                    (count >= 2 && d === suggested ? ' · Fits all your places' : ''),
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
                selected={answered.pace || prefs.party === 'family' ? prefs.pace : null}
                onPick={(k) => answer({ pace: k as Pace }, 'pace', 'getting')}
                options={[
                  { key: 'relaxed', title: 'Relaxed', detail: `Up to ${PACE_STOPS.relaxed} stops a day, about ${PACE_HOURS.relaxed} hours out${fitLine('relaxed')}` },
                  { key: 'balanced', title: 'Balanced', detail: `Up to ${PACE_STOPS.balanced} stops a day, about ${PACE_HOURS.balanced} hours out${fitLine('balanced')}` },
                  { key: 'packed', title: 'Packed', detail: `Up to ${PACE_STOPS.packed} stops a day, about ${PACE_HOURS.packed} hours out${fitLine('packed')}` },
                ]}
              />
            ) : null}

            {step === 'getting' ? (
              <Options
                selected={answered.getting ? prefs.getting : null}
                onPick={(k) => answer({ getting: k as Getting }, 'getting', nearHome ? 'build' : 'stay')}
                options={[
                  { key: 'local', title: 'Walking and autos', detail: 'Walk the short hops, auto or cab the rest' },
                  { key: 'drive', title: 'Own vehicle', detail: 'Car or bike, door to door' },
                  { key: 'bus', title: 'Bus', detail: 'Slower, with waits at the stop' },
                ]}
              />
            ) : null}
            {step === 'stay' ? (
              <Options
                selected={answered.stay ? (stayInTown ? 'town' : 'none') : null}
                onPick={(k) => {
                  setStayInTown(k === 'town');
                  answer({}, 'stay', 'build');
                }}
                options={[
                  { key: 'town', title: `In ${city.name}`, detail: 'Each day starts and ends there, drive out and back included' },
                  { key: 'none', title: 'Not sure yet', detail: 'Each day starts at its first place' },
                ]}
              />
            ) : null}
          </ScrollView>

          {step === 'dates' ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
              <Button
                trailingArrow={!!prefs.start}
                // The dates are said in full above the calendar; the button keeps to what fits a small phone.
                label={prefs.start ? 'Continue' : 'Pick a start day'}
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
    </SkyScreen>
  );
}

const QUESTION: Record<Exclude<Step, 'build'>, string> = {
  who: 'Who’s going?',
  when: 'When are you going?',
  dates: 'Which days?',
  days: 'How many days?',
  pace: 'What pace suits you?',
  getting: 'How are you getting around?',
  stay: 'Where are you staying?',
};

/** Google lets a place's coordinates be kept 30 days; after that the stay is looked up again. */
const STAY_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const freshStay = (stay: TripPrefs['stay']) => (stay && Date.now() - stay.at < STAY_KEEP_MS ? stay : null);

function centre(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  return {
    lat: points.reduce((n, p) => n + p.lat, 0) / points.length,
    lng: points.reduce((n, p) => n + p.lng, 0) / points.length,
  };
}

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
        <Text variant="label" color={skyInk.soft}>
          {option.detail}
        </Text>
      </View>
      {/* An empty ring until chosen, then the ember tick springs in over it. */}
      <View style={styles.ring}>
        <Animated.View style={[styles.tick, tick]}>
          <Feather name="check" size={14} color={skyCta} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The first of the month `iso` falls in, as an iso day. */
const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
const shiftMonth = (month: string, n: number) => {
  const d = fromIso(month);
  return isoDay(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

/**
 * One month at a time, from this one to six ahead. Tap your first day, then your last; a day more
 * than a week on starts again from there. Past days can't be picked, and look it. The chosen days
 * join into one band, the way a range reads on paper.
 */
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
  const end = start ? addDays(start, days - 1) : null;
  const [picking, setPicking] = useState<'start' | 'end'>(start && days > 1 ? 'start' : start ? 'end' : 'start');
  const [month, setMonth] = useState(() => monthOf(start ?? first));
  const earliest = monthOf(first);
  const latest = shiftMonth(earliest, MONTHS_AHEAD);
  // While choosing the last day, the longest trip there is marks how far it can go. A day past it
  // isn't locked: tapping one starts again from there, as tapping a day before the start does.
  const lastPickable = picking === 'end' && start ? addDays(start, MAX_DAYS - 1) : null;

  // The month's days under their weekdays, in whole weeks, one row each: every row is seven equal
  // cells whatever the screen's width, so a narrow phone never wraps a week onto two lines.
  const m = fromIso(month);
  const lead = m.getDay();
  const inMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: inMonth }, (_, i) => addDays(month, i)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const tap = (iso: string) => {
    haptic.selection();
    if (picking === 'start' || !start || iso < start || (!!lastPickable && iso > lastPickable)) {
      onChange(iso, 1);
      setPicking('end');
    } else {
      const span = Math.round((fromIso(iso).getTime() - fromIso(start).getTime()) / 86400000) + 1;
      onChange(start, span);
      setPicking('start');
    }
  };

  const hint = !start
    ? 'Tap the day you set off.'
    : picking === 'end'
      ? `${formatDay(start)} is day one. Tap your last day (up to ${MAX_DAYS} days), a later day to start there instead, or continue with just the one.`
      : `${formatRange(start, days)}, ${days} ${days === 1 ? 'day' : 'days'}. Tap any day to start again.`;

  return (
    <View style={styles.calendar}>
      <Text variant="label" color={skyInk.soft} accessibilityLiveRegion="polite">
        {hint}
      </Text>
      <View style={styles.monthRow}>
        <MonthStep icon="chevron-left" label="Previous month" disabled={month <= earliest} onPress={() => setMonth((x) => shiftMonth(x, -1))} />
        <Text variant="title" accessibilityRole="header">
          {MONTHS[m.getMonth()]} {m.getFullYear()}
        </Text>
        <MonthStep icon="chevron-right" label="Next month" disabled={month >= latest} onPress={() => setMonth((x) => shiftMonth(x, 1))} />
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} variant="micro" style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((iso, i) => {
            if (!iso) return <View key={i} style={styles.cell} />;
            const off = iso < first;
            const inRange = !!start && !!end && iso >= start && iso <= end;
            const edge = iso === start || iso === end;
            const band = inRange && start !== end;
            return (
              <Pressable
                key={iso}
                onPress={() => tap(iso)}
                disabled={off}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityState={{ selected: inRange, disabled: off }}
                accessibilityLabel={formatDay(iso)}
              >
                {band ? <View style={[styles.band, iso === start && styles.bandStart, iso === end && styles.bandEnd]} /> : null}
                <View style={[styles.day, edge && styles.dayEdge, off && styles.dayOff]}>
                  <Text
                    variant="data"
                    color={edge ? skyCta : off ? skyInk.faint : iso === first ? skyAccentText : skyInk.strong}
                  >
                    {fromIso(iso).getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function MonthStep({ icon, label, disabled, onPress }: { icon: 'chevron-left' | 'chevron-right'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [styles.monthStep, pressed && styles.optionPressed, disabled && styles.monthStepOff]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Feather name={icon} size={20} color={skyInk.strong} />
    </Pressable>
  );
}

/** The plan being built, step by step, then handed to the plan screen. */
function Build({ cityName, count, prefs, onBuilt }: { cityName: string; count: number; prefs: TripPrefs; onBuilt: () => void }) {
  // One place has nothing to group or fit: it gets a day, a time, and something nearby.
  const lines = count === 1 ? [
    prefs.start ? `Setting it for ${formatDay(prefs.start)}` : 'Picking a day for it',
    'Finding the best time to go',
    'Looking for a good dinner nearby',
  ] : [
    `Grouping your ${count} spots by area`,
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
      <Text variant="eyebrow">Plan your trip · {cityName}</Text>
      <Text variant="display" accessibilityRole="header" style={styles.question}>
        Building your plan
      </Text>
      <View style={styles.buildLines}>
        {lines.map((line, i) =>
          i <= done ? (
            <Animated.View key={line} entering={FADE_IN} style={styles.buildLine}>
              <View style={[styles.buildDot, i < done && styles.buildDotDone]}>
                {i < done ? <Feather name="check" size={11} color={skyCta} /> : null}
              </View>
              <Text variant="body" color={i < done ? skyInk.strong : skyInk.soft}>
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
/** The circle behind a day: fits seven across on the narrowest phone. */
const DAY = 40;

const styles = StyleSheet.create({
  hint: { marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: space.screen },
  progress: { flex: 1, flexDirection: 'row', gap: 6, paddingRight: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: skyFill.pressed, overflow: 'hidden' },
  segmentFill: { ...StyleSheet.absoluteFill, backgroundColor: skyInk.strong, transformOrigin: 'left' },
  body: { flex: 1, paddingHorizontal: space.screen, paddingTop: 28 },
  question: { marginTop: 6, marginBottom: 22 },
  questionWithHint: { marginBottom: 8 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: radii.glass,
    backgroundColor: skyFill.pane,
    borderWidth: 1,
    borderColor: skyInk.line,
  },
  // The chosen answer warms: an ember wash and rim, the one warm note on the screen.
  optionOn: { borderColor: skyAccentRim, backgroundColor: skyAccentWash },
  optionPressed: { transform: [{ scale: 0.985 }] },
  optionText: { flex: 1, gap: 2 },
  ring: { width: TICK, height: TICK, borderRadius: TICK / 2, borderWidth: 1.5, borderColor: skyInk.outline },
  tick: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    width: TICK,
    height: TICK,
    borderRadius: TICK / 2,
    backgroundColor: skyAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { position: 'absolute', left: space.screen, right: space.screen, bottom: 0 },
  calendar: { gap: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  monthStep: { width: CELL, height: CELL, borderRadius: CELL / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: skyFill.pane },
  monthStepOff: { opacity: 0.35 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  // Seven equal cells a row, each a full 44pt tall.
  cell: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  // The range as one band behind the days, starting and stopping at the middle of its end days.
  band: { position: 'absolute', top: (CELL - DAY) / 2, bottom: (CELL - DAY) / 2, left: 0, right: 0, backgroundColor: skyFill.raised },
  bandStart: { left: '50%' },
  bandEnd: { right: '50%' },
  day: { width: DAY, height: DAY, borderRadius: DAY / 2, alignItems: 'center', justifyContent: 'center' },
  dayEdge: { backgroundColor: skyInk.strong },
  // Can't be picked, and looks it: well back from the days that can.
  dayOff: { opacity: 0.4 },
  build: { flex: 1, paddingHorizontal: space.screen, paddingTop: 28 },
  buildLines: { gap: 16 },
  buildLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  buildDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: skyInk.outline, alignItems: 'center', justifyContent: 'center' },
  buildDotDone: { backgroundColor: skyInk.strong, borderColor: skyInk.strong },
});
