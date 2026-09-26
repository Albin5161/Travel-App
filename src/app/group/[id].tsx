import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Avatar } from '@/components/group/Avatar';
import { Confetti } from '@/components/group/Confetti';
import { JoinWelcome } from '@/components/group/JoinWelcome';
import { StopVote } from '@/components/group/StopVote';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { getCity, getPlace } from '@/data/api';
import { member, PARTY_COPY, whoLine } from '@/data/group';
import { formatDay, removeStop, swapStop } from '@/data/planner';
import { formatClock } from '@/lib/geo';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { EASE_OUT, fadeUp } from '@/lib/motion';
import { useGroupVote } from '@/state/group';
import { usePlanWriter } from '@/state/live';
import { useCityPlaces, useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

const web = Platform.OS === 'web';
const HEAD_IN = fadeUp(0);
const JOIN_POP = web
  ? undefined
  : new Keyframe({
      0: { opacity: 0, transform: [{ scale: 0.4 }] },
      65: { opacity: 1, transform: [{ scale: 1.12 }], easing: EASE_OUT },
      100: { opacity: 1, transform: [{ scale: 1 }] },
    }).duration(420);
const TOAST_IN = web ? undefined : FadeIn.duration(200);
const TOAST_OUT = web ? undefined : FadeOut.duration(200);

// The vote: the people on the trip join and go through the plan stop by stop. Reached from the
// share screen, a trip in the Trips tab, or cold from the shared link. When every stop is decided,
// confetti (once, whenever you first see it), and "Lock it in" applies the swaps and drops.
export default function GroupScreen() {
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  // Once, straight after joining from a link: what this is and what to do. Not on later visits.
  const [welcoming, setWelcoming] = useState(welcome === '1');
  const city = getCity(id);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { state, dispatch } = useTrips();
  const writePlan = usePlanWriter(id);
  const { kept } = useCityPlaces(id);
  const { plan, group, members, stops, verdicts, votesIn, total, approved } = useGroupVote(id);

  // Confetti the first time you see the agreement, whether it lands while you watch or while you
  // were elsewhere. Held locally so it keeps playing after the store marks it seen.
  const [celebrating, setCelebrating] = useState(false);
  if (group && approved && !group.cheered && !group.locked && !celebrating) setCelebrating(true);
  useEffect(() => {
    if (!celebrating) return;
    haptic.success();
    dispatch({ type: 'groupCheer', cityId: id });
  }, [celebrating, dispatch, id]);
  const celebrate = celebrating && !reduced;

  // "Riya joined": the latest arrival, for a moment.
  const lastJoined = group?.joined[group.joined.length - 1];
  const lastName = lastJoined ? member(lastJoined, group?.people).name : null;
  const [toast, setToast] = useState<string | null>(null);
  const seenJoins = useRef<number | null>(null);
  useEffect(() => {
    const n = group?.joined.length ?? 0;
    if (seenJoins.current !== null && n > seenJoins.current && lastName) {
      setToast(`${lastName} joined`);
      const t = setTimeout(() => setToast(null), 1600);
      seenJoins.current = n;
      return () => clearTimeout(t);
    }
    seenJoins.current = n;
  }, [group?.joined.length, lastName]);

  if (!city) return null;

  // On a shared trip: who you are, whether you made it, and whether you still have stops to vote on.
  const remote = group?.live ? state.remote[id] : undefined;
  const isOwner = !!remote && remote.me === remote.owner;
  const isVoter = !!remote && members.some((m) => m.id === remote.me);
  const myVotesDone = !!remote && stops.every(({ stop }) => group?.votes[stop.place.id]?.[remote.me]);
  const party = group?.party ?? 'friends';
  const copy = PARTY_COPY[party];
  const passLabel = party === 'partner' ? 'Hand the phone to Arya' : party === 'family' ? 'Vote as family' : 'Vote as a friend';
  const locked = !!group?.locked;
  const multiDay = (plan?.days.length ?? 0) > 1;
  const count = (k: string) => Object.values(verdicts).filter((v) => v === k).length;

  const lockIn = () => {
    if (!plan || !group) return;
    let next = plan;
    for (const { stop, day } of stops) {
      const v = verdicts[stop.place.id];
      const swap = getPlace(group.swapFor[stop.place.id] ?? '');
      if (v === 'swap' && swap) next = swapStop(next, day, stop.place.id, swap, !kept.some((p) => p.id === swap.id));
      if (v === 'drop') next = removeStop(next, day, stop.place.id);
    }
    haptic.success();
    dispatch({ type: 'groupLock', cityId: id });
    track('plan locked', { live: !!group.live });
    writePlan(next, true);
  };

  // "Albin + you", "You + Riya & Kabir": whose trip it is, and who's in.
  const liveWho = () => {
    if (!remote) return '';
    const names = members.map((m) => (m.id === remote.me ? 'you' : m.name));
    const others = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];
    return isOwner ? `You + ${others}` : `${remote.ownerName} + ${others}`;
  };
  const vote = () => router.push({ pathname: '/vote/[id]', params: { id } });
  const addStop = () => router.push({ pathname: '/addstop/[id]', params: { id } });

  const title = locked ? 'Locked in.' : approved ? copy.agreed : copy.ask;
  const sub = locked
    ? `Here’s the plan ${party === 'partner' ? 'you two' : `the ${party === 'family' ? 'family' : 'group'}`} agreed on.`
    : approved
      ? [count('keep') && `${count('keep')} kept`, count('swap') && `${count('swap')} swapped`, count('drop') && `${count('drop')} dropped`]
          .filter(Boolean)
          .join(' · ')
      : `${votesIn} of ${total} votes in`;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton icon="x" onPress={() => router.dismissTo('/trips')} accessibilityLabel="Close" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={HEAD_IN} style={styles.head}>
          <Text variant="micro">
            {city.name} · {copy.vote}
          </Text>
          <Text variant="display" style={styles.title}>
            {title}
          </Text>
          <Text variant="data">{sub}</Text>
        </Animated.View>

        {welcoming && remote && !isOwner && !locked && plan ? (
          <JoinWelcome
            ownerName={remote.ownerName}
            cityName={city.name}
            stops={stops.length}
            days={plan.days.length}
            onStart={() => {
              setWelcoming(false);
              vote();
            }}
            onDismiss={() => setWelcoming(false)}
          />
        ) : null}

        <View style={styles.people}>
          <View style={styles.avatars}>
            {members.map((m, i) => {
              const joined = group?.joined.includes(m.id);
              return (
                <View key={m.id} style={[styles.avatarSlot, i > 0 && styles.overlap]}>
                  {joined ? (
                    <Animated.View entering={JOIN_POP}>
                      <Avatar person={m} size={40} />
                    </Animated.View>
                  ) : (
                    <View style={styles.emptySlot} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.toastWrap}>
            {toast ? (
              <Animated.View key={toast} entering={TOAST_IN} exiting={TOAST_OUT} style={styles.toast}>
                <Text variant="label">{toast}</Text>
              </Animated.View>
            ) : (
              <Text variant="label" color={light.inkSoft}>
                {remote
                  ? members.length
                    ? liveWho()
                    : `Waiting for someone to join · code ${remote.code}`
                  : group?.joined.length
                    ? whoLine(party, group.joined)
                    : copy.waiting}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.list}>
          {locked && plan
            ? plan.days.flatMap((d, day) =>
                d.stops.map((s) => (
                  <View key={s.place.id} style={styles.final}>
                    <Image source={s.place.photo} style={styles.finalThumb} contentFit="cover" transition={0} />
                    <View style={styles.finalText}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {s.place.name}
                      </Text>
                      <Text variant="data">
                        {multiDay ? `Day ${day + 1} · ` : ''}
                        {formatClock(s.startMinutes)}
                      </Text>
                    </View>
                    {Object.values(group?.swapFor ?? {}).includes(s.place.id) ? (
                      <Text variant="micro" color={light.accent}>
                        Swapped in
                      </Text>
                    ) : null}
                  </View>
                )),
              )
            : stops.map(({ stop, day }) => {
                const date = plan?.days[day].date;
                const when = multiDay ? `${date ? formatDay(date) : `Day ${day + 1}`} · ` : '';
                return (
                  <StopVote
                    key={stop.place.id}
                    place={stop.place}
                    meta={`${when}${formatClock(stop.startMinutes)}`}
                    votes={group?.votes[stop.place.id]}
                    verdict={verdicts[stop.place.id]}
                    swap={getPlace(group?.swapFor[stop.place.id] ?? '')}
                    members={members}
                  />
                );
              })}
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        {locked ? (
          <Button label="Done" onPress={() => router.dismissTo('/trips')} />
        ) : remote ? (
          <>
            {isOwner && approved ? (
              <Button label="Lock it in" onPress={lockIn} />
            ) : isVoter && !myVotesDone ? (
              <Button label="Vote" onPress={vote} />
            ) : isOwner ? (
              <Button kind="secondary" label="Invite someone" onPress={() => router.push({ pathname: '/share/[id]', params: { id } })} />
            ) : (
              <Button kind="secondary" label="Change my votes" onPress={vote} />
            )}
            {approved && !isOwner ? (
              <Text variant="label" color={light.inkSoft} style={styles.waitNote}>
                Waiting for {remote.ownerName} to lock it in
              </Text>
            ) : (
              <Button kind="text" label="Add a stop" onPress={addStop} />
            )}
          </>
        ) : approved ? (
          <>
            <Button label="Lock it in" onPress={lockIn} />
            <Button kind="text" label={passLabel} onPress={() => router.push({ pathname: '/vote/[id]', params: { id } })} />
          </>
        ) : (
          <Button
            kind="secondary"
            label={passLabel}
            onPress={() => router.push({ pathname: '/vote/[id]', params: { id } })}
            disabled={!group}
          />
        )}
      </View>

      {celebrate ? <Confetti originY={insets.top + 110} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  topBar: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  waitNote: { textAlign: 'center', paddingVertical: 10 },
  head: { paddingHorizontal: 4, gap: 6 },
  title: { marginTop: 2 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 16, paddingHorizontal: 4 },
  avatars: { flexDirection: 'row' },
  avatarSlot: { width: 40, height: 40 },
  overlap: { marginLeft: -10 },
  emptySlot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: light.lineStrong,
    backgroundColor: light.canvas,
  },
  toastWrap: { flex: 1, minHeight: 32, justifyContent: 'center', alignItems: 'flex-start' },
  toast: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  list: { gap: 12 },
  final: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
  },
  finalThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: light.canvasTop },
  finalText: { flex: 1, gap: 1 },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 4,
    backgroundColor: 'rgba(245,244,241,0.94)',
  },
});
