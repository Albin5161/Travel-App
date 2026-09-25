import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Avatar } from '@/components/group/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import { PARTY_COPY, whoLine } from '@/data/group';
import { formatRange, partyOf, type TripPlan } from '@/data/planner';
import type { City } from '@/data/types';
import { EASE_OUT, fadeUp } from '@/lib/motion';
import { summarize } from '@/state/group';
import { useTrips } from '@/state/trips';
import { Tone } from '@/theme/tone';
import { fonts, light } from '@/theme/tokens';

const CARD_IN = [0, 1, 2, 3, 4, 5].map((i) => fadeUp(80 + i * 60));

type Status = { label: string; tone: 'accent' | 'ink' | 'quiet'; progress?: number };

// Every plan you've saved, and who's in on it. A trip isn't a collection: it has dates and people,
// and its own life (voting, then locked in). It's also the only screen that's about a friend who
// joined from a link, since they have no saved places of their own. Votes land here live.
export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { state } = useTrips();

  const ids = [...new Set([...Object.keys(state.savedTrips).filter((id) => state.savedTrips[id]), ...Object.keys(state.groups)])].filter(
    (id) => state.tripPlans[id] && getCity(id),
  );
  // Dated trips first, soonest first; then the ones still waiting for dates.
  const trips = ids
    .map((id) => ({ id, plan: state.tripPlans[id], city: getCity(id)! }))
    .sort((a, b) => (a.plan.days[0]?.date ?? '9999').localeCompare(b.plan.days[0]?.date ?? '9999'));

  const voting = trips.filter(({ id, plan }) => {
    const s = summarize(plan, state.groups[id]);
    return s.group && !s.group.locked && !s.approved;
  }).length;

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headRow}>
        <View style={styles.flex}>
          <Text variant="micro">{trips.length ? `${trips.length} planned${voting ? ` · ${voting} voting` : ''}` : 'Trips'}</Text>
          <Text variant="display" style={styles.title}>
            Your trips
          </Text>
        </View>
        <PressableScale onPress={() => router.push('/join')} style={styles.joinPill} accessibilityRole="button" accessibilityLabel="Join a trip with a code">
          <Feather name="user-plus" size={14} color={light.ink} />
          <Text variant="label">Join</Text>
        </PressableScale>
      </View>

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="compass" size={26} color={light.inkSoft} />
          </View>
          <Text variant="title">No trips yet</Text>
          <Text variant="body" style={styles.center}>
            Plan a trip from any city you’ve saved. It lands here, with everyone who’s coming.
          </Text>
          <Button kind="secondary" compact label="Find a city" onPress={() => router.navigate('/')} style={styles.emptyButton} />
          <Button kind="text" label="Got a code from a friend? Join their trip" onPress={() => router.push('/join')} />
        </View>
      ) : (
        <View style={styles.list}>
          {trips.map(({ id, plan, city }, i) => (
            <Animated.View key={id} entering={CARD_IN[Math.min(i, CARD_IN.length - 1)]}>
              <TripCard city={city} plan={plan} />
            </Animated.View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function TripCard({ city, plan }: { city: City; plan: TripPlan }) {
  const { state } = useTrips();
  const party = partyOf(plan.prefs);
  const { group, members, votesIn, total, approved } = summarize(plan, state.groups[city.id]);
  const stops = plan.days.reduce((n, d) => n + d.stops.length, 0);
  const when = plan.days[0]?.date ? formatRange(plan.days[0].date, plan.days.length) : `${plan.days.length} ${plan.days.length === 1 ? 'day' : 'days'}`;

  const status: Status =
    party === 'solo'
      ? { label: 'Planned', tone: 'quiet' }
      : !group
        ? { label: 'Not shared yet', tone: 'quiet' }
        : group.locked
          ? { label: 'Locked in', tone: 'ink' }
          : approved
            ? { label: PARTY_COPY[party].agreed, tone: 'ink' }
            : { label: `Voting · ${votesIn}/${total}`, tone: 'accent', progress: total ? votesIn / total : 0 };

  const open = () => {
    if (party === 'solo') router.push({ pathname: '/plan/[id]', params: { id: city.id } });
    else if (!group) router.push({ pathname: '/share/[id]', params: { id: city.id } });
    else router.push({ pathname: '/group/[id]', params: { id: city.id } });
  };

  const joined = group ? members.filter((m) => group.joined.includes(m.id)) : [];

  return (
    <PressableScale onPress={open} style={styles.card} accessibilityRole="button" accessibilityLabel={`${city.name}, ${when}, ${status.label}`}>
      <View style={styles.photo}>
        <Image source={city.hero} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
        <Tone value="dark">
          <View style={styles.photoText}>
            <Text variant="micro" color={light.photoInkSoft}>
              {when} · {stops} stops
            </Text>
            <Text style={styles.city}>{city.name}</Text>
          </View>
        </Tone>
      </View>

      <View style={styles.footer}>
        {party === 'solo' ? (
          <Text variant="label" color={light.inkSoft} style={styles.flex}>
            Just you
          </Text>
        ) : (
          <View style={styles.people}>
            {joined.length ? (
              <View style={styles.avatars}>
                {joined.map((m, i) => (
                  <Avatar key={m.id} person={m} size={28} style={i > 0 ? styles.overlap : undefined} />
                ))}
              </View>
            ) : null}
            <Text variant="label" color={light.inkSoft} numberOfLines={1} style={styles.flex}>
              {group && joined.length ? whoLine(group.party, group.joined, true) : party === 'family' ? 'Family trip' : party === 'partner' ? 'For two' : 'With friends'}
            </Text>
          </View>
        )}
        <StatusChip status={status} />
      </View>
      {status.progress !== undefined ? <Progress value={status.progress} /> : null}
    </PressableScale>
  );
}

function StatusChip({ status }: { status: Status }) {
  const tone = {
    accent: { bg: 'rgba(226,118,60,0.12)', ink: light.accent },
    ink: { bg: light.ink, ink: light.ctaInk },
    quiet: { bg: light.canvas, ink: light.inkSoft },
  }[status.tone];
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      {status.label === 'Locked in' ? <Feather name="check" size={12} color={tone.ink} /> : null}
      <Text style={[styles.chipText, { color: tone.ink }]}>{status.label}</Text>
    </View>
  );
}

// How much of the vote is in, filling as votes land.
function Progress({ value }: { value: number }) {
  const v = useSharedValue(value);
  useEffect(() => {
    v.set(withTiming(value, { duration: 400, easing: EASE_OUT }));
  }, [v, value]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: v.get() }] }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.trackFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  title: { marginTop: 6, marginBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  joinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: light.lineStrong,
    backgroundColor: light.panel,
  },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  list: { gap: 16 },
  card: {
    borderRadius: 24,
    backgroundColor: light.panel,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: light.line,
  },
  photo: { height: 150, justifyContent: 'flex-end', backgroundColor: light.canvasTop },
  photoText: { padding: 16, gap: 2 },
  city: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -1.1, color: light.photoInk },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  people: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatars: { flexDirection: 'row' },
  overlap: { marginLeft: -8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontFamily: fonts.sansSemi, fontSize: 12, lineHeight: 15 },
  track: { height: 3, backgroundColor: light.line },
  trackFill: { ...StyleSheet.absoluteFill, backgroundColor: light.accent, transformOrigin: 'left' },
  empty: { alignItems: 'center', gap: 8, marginTop: 60, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.panel,
    marginBottom: 6,
  },
  emptyButton: { marginTop: 10 },
});
