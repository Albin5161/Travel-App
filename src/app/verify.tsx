import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { SavedTick } from '@/components/motion/SavedTick';
import { AmbientBackdrop } from '@/components/pick/AmbientBackdrop';
import { SwipeCard, type CardHandle, type Dir } from '@/components/pick/SwipeCard';
import { Text } from '@/components/Text';
import type { Place } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { FADE_IN, FADE_OUT, fadeUp } from '@/lib/motion';
import { isNearHome, useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

const DONE_ENTER = [0, 1, 2, 3].map((i) => fadeUp(i * 60));

/**
 * The extraction, checked one card at a time: right if we got it right, left if we didn't. Nothing
 * is saved until the stack runs out (or "All correct" is tapped), and then only what was confirmed.
 * The swipe lives here rather than in planning because this is where a yes/no is a real question.
 */
export default function Verify() {
  const { state, dispatch } = useTrips();
  const extraction = state.lastExtraction;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; dir: Dir }[]>([]);
  const [returning, setReturning] = useState<Dir | null>(null);
  const [allCorrect, setAllCorrect] = useState(false);
  const topCard = useRef<CardHandle>(null);
  const dragX = useSharedValue(0);

  const places = extraction?.places ?? [];
  const done = allCorrect || index >= places.length;
  const wrong = new Set(history.filter((h) => h.dir === 'skip').map((h) => h.id));
  const confirmed = places.filter((p) => !wrong.has(p.id));

  // Save once, the moment the checking is over, so the card is already on Home when we get back.
  const committed = useRef(false);
  useEffect(() => {
    if (!done || !extraction || committed.current) return;
    committed.current = true;
    dispatch({ type: 'commitExtraction', extraction, placeIds: confirmed.map((p) => p.id) });
    if (confirmed.length > 0) haptic.success();
  }, [confirmed, dispatch, done, extraction]);

  // Arriving here with nothing to check (a reload, say) goes home rather than showing an empty stack.
  useEffect(() => {
    if (!extraction) router.replace('/');
  }, [extraction]);

  if (!extraction) return null;
  const { city, reel } = extraction;

  const commit = (place: Place, dir: Dir) => {
    haptic.light();
    dragX.set(0);
    setHistory((h) => [...h, { id: place.id, dir }]);
    setReturning(null);
    setIndex((i) => i + 1);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    haptic.selection();
    dragX.set(0);
    setHistory((h) => h.slice(0, -1));
    setReturning(last.dir);
    setIndex((i) => i - 1);
  };

  const cardW = W - 40;
  const cardH = Math.min(H - insets.top - insets.bottom - 290, 560);
  const visible = places.slice(index, index + 3);

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      {!done ? <AmbientBackdrop current={places[index]} next={places[index + 1]} x={dragX} width={W} /> : null}
      <View style={styles.header}>
        <IconButton
          icon="x"
          onPress={() => router.back()}
          accessibilityLabel={done ? 'Close' : 'Stop checking. Nothing is saved.'}
        />
        {!done ? (
          <View style={styles.headerRight}>
            <Animated.View key={index} entering={FADE_IN}>
              <Text variant="data">
                {index + 1} of {places.length}
              </Text>
            </Animated.View>
            {history.length > 0 ? (
              <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
                <IconButton icon="rotate-ccw" onPress={undo} accessibilityLabel="Undo last answer" />
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </View>

      {done ? (
        <Done
          count={confirmed.length}
          city={city.name}
          near={isNearHome(city.id, state.homeDistrictId)}
          left={places.filter((p) => wrong.has(p.id)).map((p) => p.name)}
          bottomInset={insets.bottom}
        />
      ) : (
        <>
          <View style={styles.titleBlock}>
            <View style={styles.source}>
              <Ionicons
                name={reel.platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
                size={13}
                color={light.inkFaint}
              />
              <Text variant="micro">
                {reel.creator} · {city.name}
              </Text>
            </View>
            <Text variant="display">Did we get it right?</Text>
          </View>
          <View style={[styles.stack, { height: cardH + 30 }]}>
            {visible
              .map((place, i) => (
                <SwipeCard
                  key={place.id}
                  ref={i === 0 ? topCard : undefined}
                  place={place}
                  depth={i}
                  width={cardW}
                  height={cardH}
                  screenW={W}
                  enterFrom={i === 0 ? returning : null}
                  fresh={i === 2 && index > 0}
                  dragX={dragX}
                  labels={{ keep: 'Right', skip: 'Wrong' }}
                  onCommit={(dir) => commit(place, dir)}
                />
              ))
              .reverse()}
          </View>
          <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.actionRow}>
              <Button kind="secondary" label="Wrong" onPress={() => topCard.current?.swipe('skip')} style={styles.action} />
              <Button label="Right" onPress={() => topCard.current?.swipe('keep')} style={styles.action} />
            </View>
            <Button
              kind="text"
              label={index === 0 ? 'All correct' : 'The rest are correct'}
              onPress={() => {
                haptic.light();
                setAllCorrect(true);
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}

function Done({
  count,
  city,
  near,
  left,
  bottomInset,
}: {
  count: number;
  city: string;
  near: boolean;
  left: string[];
  bottomInset: number;
}) {
  const where = near ? 'Near Home' : 'Cities';
  return (
    <View style={[styles.done, { paddingBottom: bottomInset + 16 }]}>
      <View style={{ flex: 1 }} />
      {count > 0 ? (
        <Animated.View entering={DONE_ENTER[0]} style={styles.tick}>
          <SavedTick size={64} />
        </Animated.View>
      ) : null}
      <Animated.View entering={DONE_ENTER[1]}>
        <Text variant="display" style={styles.center}>
          {count === 0 ? 'Nothing saved.' : `${count} ${count === 1 ? 'place' : 'places'} saved.`}
        </Text>
      </Animated.View>
      <Animated.View entering={DONE_ENTER[2]}>
        <Text variant="body" style={styles.center}>
          {count === 0
            ? "None of them were right. That one's on us."
            : `Find ${city} under ${where}.${left.length ? ` Left out ${left.join(', ')}.` : ''}`}
        </Text>
      </Animated.View>
      <View style={{ flex: 1 }} />
      <Animated.View entering={DONE_ENTER[3]}>
        <Button label={count === 0 ? 'Back home' : 'Done'} onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { paddingHorizontal: 24, marginTop: 8, gap: 6 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { marginTop: 16, alignItems: 'center' },
  actions: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  done: { flex: 1, paddingHorizontal: 24, gap: 12 },
  tick: { alignItems: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
});
