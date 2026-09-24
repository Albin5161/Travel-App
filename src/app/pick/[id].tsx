import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { AmbientBackdrop } from '@/components/pick/AmbientBackdrop';
import { SwipeCard, type CardHandle, type Dir } from '@/components/pick/SwipeCard';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import type { Place } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { FADE_IN, FADE_OUT, fadeUp } from '@/lib/motion';
import { useCityPlaces, useTrips } from '@/state/trips';
import { light } from '@/theme/tokens';

const DONE_ENTER = [0, 1, 2, 3].map((i) => fadeUp(i * 60));

export default function Pick() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const city = getCity(id);
  const { collected } = useCityPlaces(id);
  const { state, dispatch } = useTrips();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ id: string; dir: Dir }[]>([]);
  const [returning, setReturning] = useState<Dir | null>(null);
  const topCard = useRef<CardHandle>(null);
  // The front card writes its drag here so the backdrop reads the same gesture off one shared
  // value. Reset before the index moves, so the incoming card starts centred.
  const dragX = useSharedValue(0);

  const kept = collected.filter((p) => !state.skipped[p.id]).length;
  const done = index >= collected.length;

  const commit = (place: Place, dir: Dir) => {
    haptic.light();
    dragX.set(0);
    dispatch({ type: 'decide', placeId: place.id, keep: dir === 'keep' });
    setHistory((h) => [...h, { id: place.id, dir }]);
    setReturning(null);
    setIndex((i) => i + 1);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    haptic.selection();
    dragX.set(0);
    dispatch({ type: 'decide', placeId: last.id, keep: true });
    setHistory((h) => h.slice(0, -1));
    setReturning(last.dir);
    setIndex((i) => i - 1);
  };

  const cardW = W - 40;
  const cardH = Math.min(H - insets.top - insets.bottom - 250, 580);
  const visible = collected.slice(index, index + 3);

  if (!city) return null;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      {!done ? (
        <AmbientBackdrop current={collected[index]} next={collected[index + 1]} x={dragX} width={W} />
      ) : null}
      <View style={styles.header}>
        <IconButton icon="chevron-left" onPress={() => router.back()} accessibilityLabel="Back" />
        <View style={styles.headerRight}>
          <Animated.View key={`${index}-${kept}`} entering={FADE_IN}>
            <Text variant="data">
              {done ? `${collected.length} reviewed` : `${index + 1} of ${collected.length}`} · {kept} kept
            </Text>
          </Animated.View>
          {history.length > 0 && !done ? (
            <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
              <IconButton icon="rotate-ccw" onPress={undo} accessibilityLabel="Undo last choice" />
            </Animated.View>
          ) : null}
        </View>
      </View>
      <View style={styles.titleBlock}>
        <Text variant="display">{city.name}</Text>
        <Text variant="micro">Pick your places</Text>
      </View>

      {done ? (
        <DoneState
          cityId={id}
          keptCount={kept}
          skipped={collected.filter((p) => state.skipped[p.id])}
          bottomInset={insets.bottom}
        />
      ) : (
        <>
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
                  onCommit={(dir) => commit(place, dir)}
                />
              ))
              .reverse()}
          </View>
          <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.actionRow}>
              <Button kind="secondary" label="Skip" onPress={() => topCard.current?.swipe('skip')} style={styles.action} />
              <Button label="Keep" onPress={() => topCard.current?.swipe('keep')} style={styles.action} />
            </View>
            <Button
              kind="text"
              label="Keep the rest"
              trailingArrow
              onPress={() => router.replace({ pathname: '/plan/[id]', params: { id } })}
            />
          </View>
        </>
      )}
    </View>
  );
}

function DoneState({
  cityId,
  keptCount,
  skipped,
  bottomInset,
}: {
  cityId: string;
  keptCount: number;
  skipped: Place[];
  bottomInset: number;
}) {
  return (
    <View style={[styles.done, { paddingBottom: bottomInset + 16 }]}>
      <Animated.View entering={DONE_ENTER[0]}>
        <Text variant="display">
          {keptCount} {keptCount === 1 ? 'place' : 'places'} kept.
        </Text>
      </Animated.View>
      <Animated.View entering={DONE_ENTER[1]}>
        <Text variant="body">
          {skipped.length === 0
            ? "You're keeping everything. Let's turn it into a day."
            : `Skipped ${skipped.map((p) => p.name).join(', ')}. Everything else goes into your day.`}
        </Text>
      </Animated.View>
      <View style={{ flex: 1 }} />
      <Animated.View entering={DONE_ENTER[2]}>
        <Button label="Plan my day" onPress={() => router.replace({ pathname: '/plan/[id]', params: { id: cityId } })} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleBlock: { paddingHorizontal: 24, marginTop: 8, gap: 4 },
  stack: { marginTop: 16, alignItems: 'center' },
  actions: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  done: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 12 },
});
