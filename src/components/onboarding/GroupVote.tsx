import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Avatar } from '@/components/group/Avatar';
import { Text } from '@/components/Text';
import { places } from '@/data/catalog';
import { fonts, light, shadows } from '@/theme/tokens';

import { cleared, EASE, hold, LAND, seg, useLoop } from './loop';

// One stop in a shared plan, voted on live: three friends react one after another, the bar fills in
// their colours, Meera types a counter-suggestion, and the stop settles as Keeping.
const CYCLE = 6400;
const VOTE = (i: number) => 0.08 + i * 0.1;
const TYPING: [number, number] = [0.4, 0.5];
const DECIDED: [number, number] = [0.62, 0.68];

const VOTERS = [
  { member: { id: 'riya', name: 'Riya', tint: '#F4CDB0' }, emoji: '😍', fill: light.ink },
  { member: { id: 'kabir', name: 'Kabir', tint: '#C3DDD6' }, emoji: '🔥', fill: light.ink },
  { member: { id: 'meera', name: 'Meera', tint: '#DAD1F3' }, emoji: '🤔', fill: light.accent },
];

export function GroupVote({ active, width }: { active: boolean; width: number }) {
  const t = useLoop(active, CYCLE);
  const stop = places['gok-om'];
  return (
    <View
      style={[styles.card, { width: Math.min(width, 300) }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Three friends vote on Om Beach. Two love it, Meera suggests Paradise Beach, and the stop is kept."
    >
      <View style={styles.head}>
        <Image source={stop.photo} style={styles.thumb} contentFit="cover" transition={0} />
        <View style={styles.headText}>
          <Text variant="bodyStrong">{stop.name}</Text>
          <Text variant="data">Sat · 5:30 PM</Text>
        </View>
        <Status t={t} />
      </View>

      <View style={styles.bar}>
        {VOTERS.map((v, i) => (
          <View key={v.member.id} style={styles.slot}>
            <BarFill t={t} i={i} color={v.fill} />
          </View>
        ))}
      </View>

      <View style={styles.chips}>
        {VOTERS.map((v, i) => (
          <Voter key={v.member.id} t={t} i={i} member={v.member} emoji={v.emoji} />
        ))}
      </View>

      <View style={styles.noteSlot}>
        <Typing t={t} />
        <Note t={t} />
      </View>
    </View>
  );
}

/** "Voting…" until everyone's in, then it flips to the decision. */
function Status({ t }: { t: SharedValue<number> }) {
  const voting = useAnimatedStyle(() => {
    const k = seg(t.get(), DECIDED[0], DECIDED[1]) * (1 - cleared(t.get()));
    return { opacity: 1 - k };
  });
  const kept = useAnimatedStyle(() => {
    const x = t.get();
    const k = EASE(seg(x, DECIDED[0], DECIDED[1])) * (1 - cleared(x));
    return { opacity: k, transform: [{ scale: 0.92 + 0.08 * LAND(seg(x, DECIDED[0], DECIDED[1])) }] };
  });
  return (
    <View style={styles.status}>
      <Animated.View style={[styles.pill, styles.pillVoting, voting]}>
        <Text style={[styles.pillText, { color: light.inkSoft }]}>Voting…</Text>
      </Animated.View>
      <Animated.View style={[styles.pill, styles.pillKept, kept]}>
        <Text style={styles.pillText}>Keeping</Text>
      </Animated.View>
    </View>
  );
}

/** Each vote fills its third of the bar from the left, in the voter's colour. */
function BarFill({ t, i, color }: { t: SharedValue<number>; i: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const a = EASE(seg(x, VOTE(i) + 0.02, VOTE(i) + 0.08));
    return { opacity: 1 - cleared(x), transform: [{ scaleX: Math.max(0.001, a) }] };
  });
  return <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />;
}

/** A friend's reaction: the chip lands, then the emoji pops a beat later. */
function Voter({
  t,
  i,
  member,
  emoji,
}: {
  t: SharedValue<number>;
  i: number;
  member: { id: string; name: string; tint: string };
  emoji: string;
}) {
  const chip = useAnimatedStyle(() => {
    const x = t.get();
    const a = seg(x, VOTE(i), VOTE(i) + 0.06);
    return {
      opacity: Math.min(1, a * 3) * (1 - cleared(x)),
      transform: [{ translateY: (1 - LAND(a)) * 10 }, { scale: 0.92 + 0.08 * LAND(a) }],
    };
  });
  const pop = useAnimatedStyle(() => {
    const a = seg(t.get(), VOTE(i) + 0.03, VOTE(i) + 0.09);
    return { transform: [{ scale: 0.5 + 0.5 * LAND(a) }] };
  });
  return (
    <Animated.View style={[styles.chip, chip]}>
      <Avatar person={member} size={22} />
      <Animated.Text style={[styles.emoji, pop]}>{emoji}</Animated.Text>
    </Animated.View>
  );
}

function Typing({ t }: { t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const on = hold(t.get(), TYPING[0], TYPING[0] + 0.02, TYPING[1] - 0.01, TYPING[1] + 0.01);
    return { opacity: on, transform: [{ translateY: (1 - EASE(on)) * 6 }] };
  });
  return (
    <Animated.View style={[styles.bubble, styles.typing, style]}>
      <Avatar person={VOTERS[2].member} size={18} />
      {[0, 1, 2].map((k) => (
        <TypingDot key={k} t={t} k={k} />
      ))}
    </Animated.View>
  );
}

function TypingDot({ t, k }: { t: SharedValue<number>; k: number }) {
  const style = useAnimatedStyle(() => {
    // Three bounces across the typing window, each dot a little behind the last.
    const phase = seg(t.get(), TYPING[0], TYPING[1]) * 3 - k * 0.18;
    const b = Math.max(0, Math.sin(phase * Math.PI * 2));
    return { opacity: 0.35 + 0.65 * b, transform: [{ translateY: -2.5 * b }] };
  });
  return <Animated.View style={[styles.typingDot, style]} />;
}

function Note({ t }: { t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const x = t.get();
    const a = seg(x, TYPING[1], TYPING[1] + 0.05);
    return { opacity: a * (1 - cleared(x)), transform: [{ translateY: (1 - EASE(a)) * 8 }] };
  });
  return (
    <Animated.View style={[styles.bubble, style]}>
      <Text variant="label">
        <Text variant="label" style={styles.noteName}>
          Meera
        </Text>
        {'  '}What about Paradise Beach?
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
    borderRadius: 22,
    backgroundColor: light.panel,
    borderWidth: 1,
    borderColor: light.line,
    boxShadow: shadows.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 13, backgroundColor: light.canvasTop },
  headText: { flex: 1, gap: 1 },
  status: { width: 74, height: 26, alignItems: 'flex-end', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    right: 0,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillVoting: { backgroundColor: light.canvas, borderWidth: 1, borderColor: light.line },
  pillKept: { backgroundColor: light.ink },
  pillText: { fontFamily: fonts.sansSemi, fontSize: 12, lineHeight: 15, color: light.ctaInk },
  bar: { flexDirection: 'row', gap: 4, height: 6 },
  slot: { flex: 1, borderRadius: 3, overflow: 'hidden', backgroundColor: light.canvas },
  fill: { flex: 1, transformOrigin: 'left' },
  chips: { flexDirection: 'row', gap: 8 },
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
  noteSlot: { height: 34 },
  bubble: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    backgroundColor: light.canvas,
  },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 6 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: light.inkSoft },
  noteName: { fontFamily: fonts.sansSemi, color: light.ink },
});
