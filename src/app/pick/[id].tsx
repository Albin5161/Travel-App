import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/Button';
import { PlaceCard } from '@/components/PlaceCard';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { getCity } from '@/data/api';
import type { Place } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { EASE_OUT, FADE_IN, FADE_OUT, project, SPRING_DRAG, SPRING_SETTLE, fadeUp } from '@/lib/motion';
import { useCityPlaces, useTrips } from '@/state/trips';
import { colors, fonts } from '@/theme/tokens';

type Dir = 'keep' | 'skip';
type CardHandle = { swipe: (dir: Dir) => void };
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

  const kept = collected.filter((p) => !state.skipped[p.id]).length;
  const done = index >= collected.length;

  const commit = (place: Place, dir: Dir) => {
    haptic.light();
    dispatch({ type: 'decide', placeId: place.id, keep: dir === 'keep' });
    setHistory((h) => [...h, { id: place.id, dir }]);
    setReturning(null);
    setIndex((i) => i + 1);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    haptic.selection();
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
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="chevron-left" size={22} color={colors.mist} />
        </PressableScale>
        <View style={styles.headerRight}>
          <Animated.View key={`${index}-${kept}`} entering={FADE_IN}>
            <Text variant="data">
              {done ? `${collected.length} reviewed` : `${index + 1} of ${collected.length}`} · {kept} kept
            </Text>
          </Animated.View>
          {history.length > 0 && !done ? (
            <Animated.View entering={FADE_IN} exiting={FADE_OUT}>
              <PressableScale onPress={undo} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Undo last choice">
                <Feather name="rotate-ccw" size={17} color={colors.mist} />
              </PressableScale>
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

type SwipeProps = {
  ref?: Ref<CardHandle>;
  place: Place;
  depth: number;
  width: number;
  height: number;
  screenW: number;
  enterFrom: Dir | null;
  /** Newly revealed at the back of the stack: fade in from one step further back. */
  fresh?: boolean;
  onCommit: (dir: Dir) => void;
};

function SwipeCard({ ref, place, depth, width, height, screenW, enterFrom, fresh, onCommit }: SwipeProps) {
  const reduced = useReducedMotion();
  const offscreen = screenW * 1.4;
  const x = useSharedValue(enterFrom ? (enterFrom === 'keep' ? offscreen : -offscreen) : 0);
  const y = useSharedValue(0);
  const d = useSharedValue(fresh ? depth + 1 : depth);
  const start = useSharedValue({ x: 0, y: 0 });

  useEffect(() => {
    if (enterFrom) x.set(withSpring(0, SPRING_SETTLE));
    // Mount-only: an undone card flies back in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    d.set(withSpring(depth, SPRING_SETTLE));
  }, [d, depth]);

  const flyOff = (dir: Dir, velocity = 0) => {
    'worklet';
    const sign = dir === 'keep' ? 1 : -1;
    x.set(
      withTiming(sign * offscreen, { duration: reduced ? 150 : 250, easing: EASE_OUT }, (finished) => {
        if (finished) scheduleOnRN(onCommit, dir);
      }),
    );
    y.set(withTiming(y.get() + velocity * 0.05, { duration: 250, easing: EASE_OUT }));
  };

  useImperativeHandle(ref, () => ({ swipe: (dir: Dir) => flyOff(dir) }));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(depth === 0)
        .activeOffsetX([-10, 10])
        .onStart(() => {
          start.set({ x: x.get(), y: y.get() });
        })
        .onUpdate((e) => {
          x.set(start.get().x + e.translationX);
          y.set(start.get().y + e.translationY * 0.35);
        })
        .onEnd((e) => {
          const projected = x.get() + project(e.velocityX);
          if (Math.abs(projected) > screenW * 0.4) {
            flyOff(projected > 0 ? 'keep' : 'skip', e.velocityY);
          } else {
            x.set(withSpring(0, { ...SPRING_DRAG, velocity: e.velocityX }));
            y.set(withSpring(0, { ...SPRING_DRAG, velocity: e.velocityY }));
          }
        }),
    // flyOff closes over x/y/onCommit, which are stable for a mounted card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [depth, screenW],
  );

  const style = useAnimatedStyle(() => {
    const depthV = d.get();
    const dragRot = reduced ? 0 : interpolate(x.get(), [-screenW, 0, screenW], [-12, 0, 12]);
    const fanRot = interpolate(depthV, [0, 1, 2], [0, -4, 5], Extrapolation.CLAMP);
    return {
      opacity: interpolate(depthV, [0, 2, 3], [1, 0.85, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: x.get() },
        { translateY: y.get() + depthV * 14 },
        { scale: 1 - depthV * 0.05 },
        { rotate: `${dragRot + fanRot}deg` },
      ],
    };
  });

  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, width * 0.35], [0, 1], Extrapolation.CLAMP),
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-width * 0.35, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, { width, height, zIndex: 10 - depth, pointerEvents: depth === 0 ? 'auto' : 'none' }, style]}
      >
        <PlaceCard
          place={place}
          style={{ width, height }}
          overlay={
            <>
              <Animated.View style={[styles.stamp, styles.stampKeep, keepStyle]} pointerEvents="none">
                <Text style={[styles.stampText, { color: colors.night }]}>Keep</Text>
              </Animated.View>
              <Animated.View style={[styles.stamp, styles.stampSkip, skipStyle]} pointerEvents="none">
                <Text style={[styles.stampText, { color: colors.mist }]}>Skip</Text>
              </Animated.View>
            </>
          }
        />
      </Animated.View>
    </GestureDetector>
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
  fill: { flex: 1, backgroundColor: colors.night },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  titleBlock: { paddingHorizontal: 24, marginTop: 8, gap: 4 },
  stack: { marginTop: 16, alignItems: 'center' },
  card: { position: 'absolute', top: 0 },
  stamp: {
    position: 'absolute',
    top: 64,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stampKeep: { left: 20, backgroundColor: colors.ember, transform: [{ rotate: '-8deg' }] },
  stampSkip: {
    right: 20,
    backgroundColor: colors.glassDark,
    borderWidth: 1,
    borderColor: colors.rimStrong,
    transform: [{ rotate: '8deg' }],
  },
  stampText: { fontFamily: fonts.sansSemi, fontSize: 18, letterSpacing: 0.5 },
  actions: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  done: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 12 },
});
