import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { FRIENDS, friend, type Verdict, type Vote, type VoteKind } from '@/data/group';
import type { Place } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { EASE_IN_OUT, EASE_OUT } from '@/lib/motion';
import { fonts, light } from '@/theme/tokens';

import { Avatar } from './Avatar';

// One stop in the group vote. Votes pop in as avatar + emoji chips, a three-slot bar fills (one slot
// per friend, coloured by their call), and the latest comment shows underneath. When the group
// overrules the stop, its header flips over to the place they swapped in.

const web = Platform.OS === 'web';
// A vote lands: pops from 0.6 past 1 and settles. Web skips entering animations (see lib/motion).
const POP = web
  ? undefined
  : new Keyframe({
      0: { opacity: 0, transform: [{ scale: 0.6 }] },
      60: { opacity: 1, transform: [{ scale: 1.08 }], easing: EASE_OUT },
      100: { opacity: 1, transform: [{ scale: 1 }] },
    }).duration(320);
const NOTE_IN = web ? undefined : FadeIn.duration(220);

export const VOTE_COLOR: Record<VoteKind, string> = { keep: light.ink, swap: light.accent, drop: light.inkFaint };

type Props = {
  place: Place;
  meta: string;
  votes: Record<string, Vote> | undefined;
  verdict: Verdict;
  swap?: Place;
};

export function StopVote({ place, meta, votes, verdict, swap }: Props) {
  const reduced = useReducedMotion();
  const flip = useSharedValue(verdict === 'swap' && swap ? 1 : 0);
  const swapped = verdict === 'swap' && !!swap;

  useEffect(() => {
    if (!swapped || flip.get() === 1) return;
    haptic.light();
    flip.set(withTiming(1, { duration: reduced ? 0 : 560, easing: EASE_IN_OUT }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapped]);

  // Two faces of one header, back to back. Reduce Motion crossfades instead of turning.
  const front = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - flip.get() }
      : { transform: [{ perspective: 800 }, { rotateX: `${flip.get() * 180}deg` }] },
  );
  const back = useAnimatedStyle(() =>
    reduced
      ? { opacity: flip.get() }
      : { transform: [{ perspective: 800 }, { rotateX: `${flip.get() * 180 - 180}deg` }] },
  );

  const list = Object.entries(votes ?? {});
  // Once decided, the winning side's reason; until then, the latest thing anyone said.
  const decided = verdict === 'swap' || verdict === 'drop' ? verdict : null;
  const latestNote =
    [...list].reverse().find(([, v]) => v.note && (!decided || v.kind === decided)) ??
    [...list].reverse().find(([, v]) => v.note);
  const byFriend = FRIENDS.map((f) => votes?.[f.id]);
  const swappers = list.filter(([, v]) => v.kind === 'swap').map(([id]) => friend(id).name);

  return (
    <View style={[styles.card, verdict === 'drop' && styles.cardDropped]}>
      <View>
        <Animated.View style={[styles.face, front]}>
          <Head place={place} meta={meta} dropped={verdict === 'drop'} />
          <VerdictPill verdict={swapped ? 'waiting' : verdict} />
        </Animated.View>
        {swap ? (
          <Animated.View style={[styles.face, styles.backFace, back]} pointerEvents={swapped ? 'auto' : 'none'}>
            <Head
              place={swap}
              meta={`${swappers.join(' & ') || 'The group'}’s pick · instead of ${place.name}`}
              kicker="Swapped in"
            />
            <VerdictPill verdict="swap" />
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.bar}>
        {byFriend.map((v, i) => (
          <View key={FRIENDS[i].id} style={styles.slot}>
            {v ? <SlotFill key={v.kind} color={VOTE_COLOR[v.kind]} /> : null}
          </View>
        ))}
      </View>

      <View style={styles.votes}>
        {list.length === 0 ? (
          <Text variant="data" color={light.inkFaint}>
            Waiting for votes…
          </Text>
        ) : (
          list.map(([id, v]) => (
            <Animated.View key={id} entering={POP} style={styles.chip}>
              <Avatar friend={friend(id)} size={22} />
              <Text style={styles.emoji}>{v.emoji}</Text>
            </Animated.View>
          ))
        )}
      </View>

      {latestNote ? (
        <Animated.View key={`${latestNote[0]}:${latestNote[1].note}`} entering={NOTE_IN} style={styles.note}>
          <Text variant="label" numberOfLines={2}>
            <Text variant="label" style={styles.noteName}>
              {friend(latestNote[0]).name}
            </Text>
            {'  '}
            {latestNote[1].note}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Head({ place, meta, dropped, kicker }: { place: Place; meta: string; dropped?: boolean; kicker?: string }) {
  return (
    <View style={styles.head}>
      <Image source={place.photo} style={styles.thumb} contentFit="cover" transition={0} />
      <View style={styles.headText}>
        {kicker ? (
          <Text variant="micro" color={light.accent}>
            {kicker}
          </Text>
        ) : null}
        <Text variant="bodyStrong" numberOfLines={1} style={dropped && styles.struck}>
          {place.name}
        </Text>
        <Text variant="data" numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </View>
  );
}

const PILL: Record<Verdict, { label: string; bg: string; ink: string }> = {
  waiting: { label: 'Voting…', bg: 'transparent', ink: light.inkFaint },
  keep: { label: 'Keeping', bg: light.ink, ink: light.ctaInk },
  swap: { label: 'Swapped', bg: light.accent, ink: light.ctaInk },
  drop: { label: 'Dropped', bg: light.line, ink: light.inkSoft },
};

function VerdictPill({ verdict }: { verdict: Verdict }) {
  const p = PILL[verdict];
  return (
    <Animated.View key={verdict} entering={verdict === 'waiting' ? undefined : POP} style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.pillText, { color: p.ink }]}>{p.label}</Text>
    </Animated.View>
  );
}

// A slot filling from the left as its vote lands.
function SlotFill({ color }: { color: string }) {
  const s = useSharedValue(web ? 1 : 0);
  useEffect(() => {
    s.set(withTiming(1, { duration: 320, easing: EASE_OUT }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: s.get() }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: light.panel,
    borderRadius: 22,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: light.line,
  },
  cardDropped: { opacity: 0.6 },
  face: { flexDirection: 'row', alignItems: 'center', gap: 10, backfaceVisibility: 'hidden' },
  backFace: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  head: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: light.canvasTop },
  headText: { flex: 1, gap: 1 },
  struck: { textDecorationLine: 'line-through', color: light.inkSoft },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontFamily: fonts.sansSemi, fontSize: 12, lineHeight: 15 },
  bar: { flexDirection: 'row', gap: 4, height: 6 },
  slot: { flex: 1, borderRadius: 3, backgroundColor: light.line, overflow: 'hidden' },
  fill: { transformOrigin: 'left' },
  votes: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 3,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: light.canvas,
  },
  emoji: { fontSize: 14, lineHeight: 18 },
  note: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    backgroundColor: light.canvas,
  },
  noteName: { fontFamily: fonts.sansSemi, color: light.ink },
});
