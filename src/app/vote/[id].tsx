import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Avatar } from '@/components/group/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { getPlace } from '@/data/api';
import { FRIENDS, QUICK_NOTES, friend, type VoteKind } from '@/data/group';
import { formatClock } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';
import { useGroupVote } from '@/state/group';
import { useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

const web = Platform.OS === 'web';
const NEXT_IN = web ? undefined : SlideInRight.duration(280).easing(EASE_OUT);
const STEP_IN = web ? undefined : FadeIn.duration(200);
const EMOJI = ['😍', '🔥', '🙌', '🤔', '😴'];
const DEFAULT_EMOJI: Record<VoteKind, string> = { keep: '👍', swap: '🔁', drop: '✋' };

// Pass the phone: whoever's holding it picks which friend they are, then goes stop by stop.
// Their votes replace that friend's scripted ones; the group screen underneath updates live.
export default function VoteSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { dispatch } = useTrips();
  // The group screen underneath runs the script; this sheet only votes.
  const { group, stops } = useGroupVote(id, { live: false });
  const [voter, setVoter] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!group) return null;

  const choose = (friendId: string) => {
    haptic.selection();
    dispatch({ type: 'groupManual', cityId: id, friendId });
    setVoter(friendId);
    setIndex(0);
  };

  const cast = (kind: VoteKind) => {
    if (!voter) return;
    const { stop } = stops[index];
    haptic.selection();
    dispatch({
      type: 'groupVote',
      cityId: id,
      placeId: stop.place.id,
      friendId: voter,
      vote: { kind, emoji: emoji ?? DEFAULT_EMOJI[kind], note: note ?? undefined },
    });
    setEmoji(null);
    setNote(null);
    setIndex(index + 1);
  };

  // 1. Who's voting?
  if (!voter) {
    return (
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}>
        <Text variant="micro">Pass the phone</Text>
        <Text variant="display" style={styles.title}>
          Who’s voting?
        </Text>
        <View style={styles.who}>
          {FRIENDS.map((f) => {
            const done = stops.filter(({ stop }) => group.votes[stop.place.id]?.[f.id]).length;
            return (
              <PressableScale key={f.id} onPress={() => choose(f.id)} style={styles.whoRow} accessibilityRole="button" accessibilityLabel={`Vote as ${f.name}`}>
                <Avatar friend={f} size={44} />
                <View style={styles.flex}>
                  <Text variant="title">{f.name}</Text>
                  <Text variant="data">
                    {done === stops.length ? 'Voted on everything · change their votes' : `${done} of ${stops.length} voted`}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  const me = friend(voter);

  // 3. Done.
  if (index >= stops.length) {
    return (
      <Animated.View entering={STEP_IN} style={[styles.pad, styles.done, { paddingBottom: insets.bottom + 24 }]}>
        <Avatar friend={me} size={64} />
        <Text variant="display" style={styles.center}>
          Thanks, {me.name}!
        </Text>
        <Text variant="body" style={styles.center}>
          Pass the phone back. Your votes are in.
        </Text>
        <View style={styles.doneActions}>
          <Button label="Done" onPress={() => router.back()} />
          <Button kind="text" label="Vote as someone else" onPress={() => setVoter(null)} />
        </View>
      </Animated.View>
    );
  }

  // 2. One stop at a time.
  const { stop, day } = stops[index];
  const swap = getPlace(group.swapFor[stop.place.id] ?? '');
  const multiDay = stops.some((s) => s.day > 0);

  return (
    <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.voterRow}>
        <Avatar friend={me} size={28} />
        <Text variant="label">Voting as {me.name}</Text>
        <Text variant="data" style={styles.progress}>
          {index + 1} / {stops.length}
        </Text>
      </View>

      <Animated.View key={stop.place.id} entering={NEXT_IN}>
        <Image source={stop.place.photo} style={styles.photo} contentFit="cover" transition={0} />
        <Text variant="headline" style={styles.placeName}>
          {stop.place.name}
        </Text>
        <Text variant="data">
          {multiDay ? `Day ${day + 1} · ` : ''}
          {formatClock(stop.startMinutes)} · {stop.place.area}
        </Text>

        <Text variant="micro" style={styles.section}>
          React
        </Text>
        <View style={styles.row}>
          {EMOJI.map((e) => (
            <PressableScale
              key={e}
              onPress={() => {
                haptic.selection();
                setEmoji(emoji === e ? null : e);
              }}
              style={[styles.emojiButton, emoji === e && styles.selected]}
              accessibilityRole="button"
              accessibilityState={{ selected: emoji === e }}
            >
              <Text style={styles.emoji}>{e}</Text>
            </PressableScale>
          ))}
        </View>
        <View style={styles.notes}>
          {QUICK_NOTES.map((n) => (
            <PressableScale
              key={n}
              onPress={() => setNote(note === n ? null : n)}
              style={[styles.noteChip, note === n && styles.noteSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: note === n }}
            >
              <Text variant="label" color={note === n ? light.ctaInk : light.ink}>
                {n}
              </Text>
            </PressableScale>
          ))}
        </View>

        <View style={styles.cast}>
          <Button label="Keep it" onPress={() => cast('keep')} />
          {swap ? <Button kind="secondary" label={`Swap for ${swap.name}`} onPress={() => cast('swap')} /> : null}
          <Button kind="text" label="Drop it" onPress={() => cast('drop')} />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 22, paddingTop: 28 },
  flex: { flex: 1 },
  title: { marginTop: 6 },
  who: { marginTop: 20, gap: 10 },
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: light.canvas,
  },
  voterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  progress: { marginLeft: 'auto' },
  photo: { width: '100%', height: 190, borderRadius: 22, backgroundColor: light.canvasTop },
  placeName: { marginTop: 14 },
  section: { marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvas,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selected: { borderColor: light.ink, backgroundColor: light.panel },
  emoji: { fontSize: 22, lineHeight: 28 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  noteChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: light.canvas },
  noteSelected: { backgroundColor: light.ink },
  cast: { marginTop: 22, gap: 8 },
  done: { alignItems: 'center', gap: 10, paddingTop: 48 },
  center: { textAlign: 'center' },
  doneActions: { alignSelf: 'stretch', marginTop: 18, gap: 4 },
});

