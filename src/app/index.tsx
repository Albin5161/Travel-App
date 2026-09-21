import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PhotoCard } from '@/components/PhotoCard';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { detectPlatform, getCity } from '@/data/api';
import { heroDusk, SAMPLE_LINK } from '@/data/catalog';
import { fadeUp, NUDGE_IN } from '@/lib/motion';
import { useTrips, type CityCollection } from '@/state/trips';
import { colors, fonts } from '@/theme/tokens';

const ENTER = [0, 1, 2, 3, 4].map((i) => fadeUp(120 + i * 60));

export default function Home() {
  const { state } = useTrips();
  const cols = Object.values(state.collections).sort((a, b) => b.addedAt - a.addedAt);
  return cols.length === 0 ? <EmptyHome /> : <CollectionHome collections={cols} />;
}

function useClipboardLink() {
  const [hasLink, setHasLink] = useState(false);
  const check = useCallback(() => {
    // hasUrlAsync reads no content, so iOS shows no paste prompt until the user taps.
    if (Platform.OS !== 'ios') return;
    Clipboard.hasUrlAsync()
      .then(setHasLink)
      .catch(() => setHasLink(false));
  }, []);
  useFocusEffect(check);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [check]);
  return [hasLink, setHasLink] as const;
}

function useStartFromLink() {
  const { dispatch } = useTrips();
  return (url: string) => {
    dispatch({ type: 'setPendingLink', url });
    router.push('/analysing');
  };
}

function ClipboardNudge({ onDone }: { onDone: () => void }) {
  const start = useStartFromLink();
  const onPress = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    onDone();
    if (detectPlatform(text)) start(text);
    else router.push({ pathname: '/paste', params: { prefill: text } });
  };
  return (
    <Animated.View entering={NUDGE_IN}>
      <PressableScale onPress={onPress} style={styles.nudge} accessibilityRole="button">
        <Feather name="link" size={15} color={colors.mist} />
        <Text variant="label">Link on your clipboard</Text>
        <Text variant="label" color={colors.ember}>
          Add it
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

function GhostPin({ x, y, delay }: { x: number; y: number; delay: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) return;
    o.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(withTiming(0.6, { duration: 1200 }), withTiming(0.25, { duration: 1200 })),
          -1,
        ),
      ),
    );
  }, [delay, o, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ghost, { left: x - 16, top: y - 16 }, style]}>
      <View style={styles.ghostDot} />
    </Animated.View>
  );
}

function EmptyHome() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [hasLink, setHasLink] = useClipboardLink();
  const start = useStartFromLink();

  const drift = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    drift.set(withRepeat(withTiming(1.08, { duration: 20000, easing: Easing.linear }), -1, true));
  }, [drift, reduced]);
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ scale: drift.get() }] }));

  return (
    <View style={styles.fill}>
      <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
        <Image source={heroDusk} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      </Animated.View>
      <LinearGradient
        colors={['rgba(13,15,14,0.45)', 'rgba(13,15,14,0)', 'rgba(13,15,14,0)', 'rgba(13,15,14,0.9)', colors.night]}
        locations={[0, 0.16, 0.34, 0.58, 0.74]}
        style={StyleSheet.absoluteFill}
      />
      <GhostPin x={W * 0.3} y={H * 0.27} delay={0} />
      <GhostPin x={W * 0.66} y={H * 0.21} delay={800} />
      <GhostPin x={W * 0.52} y={H * 0.38} delay={1600} />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.wordmark}>Raahi</Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        {hasLink ? <ClipboardNudge onDone={() => setHasLink(false)} /> : null}
        <Animated.View entering={ENTER[0]}>
          <Text variant="micro">Your saved reels, finally useful</Text>
        </Animated.View>
        <Animated.View entering={ENTER[1]}>
          <Text variant="display">Your next trip is hiding in your saved reels.</Text>
        </Animated.View>
        <Animated.View entering={ENTER[2]}>
          <Text variant="body">
            Paste an Instagram or YouTube link. We’ll find every place in it and put them on your map.
          </Text>
        </Animated.View>
        <Animated.View entering={ENTER[3]} style={styles.cta}>
          <Button label="Paste a link" onPress={() => router.push('/paste')} />
        </Animated.View>
        <Animated.View entering={ENTER[4]}>
          <Button kind="text" label="Try a sample link" trailingArrow onPress={() => start(SAMPLE_LINK)} />
        </Animated.View>
      </View>
    </View>
  );
}

function CollectionHome({ collections }: { collections: CityCollection[] }) {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useTrips();
  const [hasLink, setHasLink] = useClipboardLink();
  const fresh = state.freshCityId;

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => dispatch({ type: 'clearFresh' }), 600);
    return () => clearTimeout(t);
  }, [dispatch, fresh]);

  const spots = collections.reduce((n, c) => n + c.placeIds.length, 0);

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 140, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.wordmark}>Raahi</Text>
        <View style={styles.homeHeader}>
          <Text variant="display">Your places</Text>
          <Text variant="data">
            {collections.length} {collections.length === 1 ? 'city' : 'cities'} · {spots} spots
          </Text>
        </View>
        <View style={{ gap: 16 }}>
          {collections.map((c) => (
            <Animated.View key={c.cityId} entering={c.cityId === fresh ? ENTER[1] : undefined}>
              <CityCard collection={c} planned={!!state.savedTrips[c.cityId]} />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(13,15,14,0)', colors.night]}
        style={[styles.bottomFade, { height: insets.bottom + 140 }]}
      />
      <View style={[styles.floating, { paddingBottom: insets.bottom + 16 }]}>
        {hasLink ? <ClipboardNudge onDone={() => setHasLink(false)} /> : null}
        <Button label="Paste a link" onPress={() => router.push('/paste')} />
      </View>
    </View>
  );
}

function CityCard({ collection, planned }: { collection: CityCollection; planned: boolean }) {
  const city = getCity(collection.cityId);
  if (!city) return null;
  const reels = collection.reelIds.length;
  return (
    <PressableScale
      onPress={() => router.push(`/city/${city.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${city.name}, ${collection.placeIds.length} spots`}
    >
      <PhotoCard source={city.hero} style={styles.cityCard}>
        <View style={styles.cityCardBody}>
          <Text variant="displayXL">{city.name}</Text>
          <View style={styles.cityMeta}>
            <Text variant="micro">
              {collection.placeIds.length} spots · {reels} {reels === 1 ? 'reel' : 'reels'}
            </Text>
            {planned ? (
              <Text variant="micro" color={colors.ember}>
                · Day planned
              </Text>
            ) : null}
          </View>
        </View>
      </PhotoCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.night },
  topBar: { paddingHorizontal: 24 },
  wordmark: { fontFamily: fonts.serif, fontSize: 28, color: colors.mist },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 14 },
  cta: { marginTop: 10 },
  ghost: { position: 'absolute', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  ghostDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.ember,
    backgroundColor: 'rgba(226,118,60,0.15)',
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  homeHeader: { marginTop: 28, marginBottom: 20, gap: 6 },
  cityCard: { height: 240 },
  cityCardBody: { position: 'absolute', left: 22, right: 22, bottom: 20, gap: 6 },
  cityMeta: { flexDirection: 'row', gap: 6 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  floating: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 12 },
});
