import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { PhotoCard } from '@/components/PhotoCard';
import { Text } from '@/components/Text';
import { extractPlaces, getLinkPreview } from '@/data/api';
import { SAMPLE_LINK } from '@/data/catalog';
import type { Extraction, Reel } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { CARD_IN, CREDIT_IN, FADE_IN, FADE_OUT, fadeUp } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { Tone } from '@/theme/tone';
import { colors, light } from '@/theme/tokens';

type Phase = 'reading' | 'finding' | 'done';
const STATUS: Record<Phase, string> = {
  reading: 'Reading the description…',
  finding: 'Finding places…',
  done: 'All found',
};
const CREDIT_GAP_MS = 130;
const CHOICE_ENTER = [0, 1].map((i) => fadeUp(i * 60));
// A single-spot reel skips the choice: confirm, then straight back home.
const QUICK_SAVE_MS = 1400;

export default function Analysing() {
  const { state, dispatch } = useTrips();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [url] = useState(() => state.pendingLink ?? SAMPLE_LINK);
  const [preview, setPreview] = useState<Reel | null>(null);
  const [result, setResult] = useState<Extraction | null>(null);
  const [shown, setShown] = useState(0);
  // Cities the user had before this link, to tell "new city" from "adding to one".
  const [knownCities] = useState(() => new Set(Object.keys(state.collections)));
  const cancelled = useRef(false);
  const phase: Phase = !result ? 'reading' : shown < result.places.length ? 'finding' : 'done';

  useEffect(() => {
    cancelled.current = false;
    getLinkPreview(url).then((p) => !cancelled.current && setPreview(p));
    extractPlaces(url).then((r) => {
      if (!cancelled.current) setResult(r);
    });
    return () => {
      cancelled.current = true;
    };
  }, [url]);

  // Roll the place names in like film credits. The places are saved as soon as they're all found;
  // what's left is the user's choice: stay collecting, or plan the trip now.
  useEffect(() => {
    if (!result) return;
    if (shown < result.places.length) {
      const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 200 : CREDIT_GAP_MS);
      return () => clearTimeout(t);
    }
    haptic.success();
    dispatch({ type: 'commitExtraction', extraction: result });
    if (result.places.length !== 1) return;
    const t = setTimeout(() => !cancelled.current && router.back(), QUICK_SAVE_MS);
    return () => clearTimeout(t);
  }, [dispatch, result, shown]);

  const existed = !!result && knownCities.has(result.city.id);

  const planTrip = () => {
    if (!result) return;
    router.replace({ pathname: '/city/[id]', params: { id: result.city.id, reveal: '1' } });
  };

  const cardW = W - 48;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      <IconButton
        icon="x"
        onPress={() => router.back()}
        accessibilityLabel={phase === 'done' ? 'Close' : 'Cancel'}
        style={styles.close}
      />

      <View style={styles.body}>
        {preview ? (
          <Animated.View entering={CARD_IN}>
            <Tone value="dark">
              <PhotoCard source={preview.thumbnail} style={{ width: cardW, height: cardW * 0.62 }}>
                <Shimmer width={cardW} active={phase === 'reading'} />
                <View style={styles.previewText}>
                  <View style={styles.sourceRow}>
                    <Ionicons
                      name={preview.platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
                      size={14}
                      color={colors.mist}
                    />
                    <Text variant="micro" color={colors.mist}>
                      {preview.creator} · {preview.duration}
                    </Text>
                  </View>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {preview.title}
                  </Text>
                </View>
              </PhotoCard>
            </Tone>
          </Animated.View>
        ) : (
          <View style={{ width: cardW, height: cardW * 0.62 }} />
        )}

        <View style={styles.statusRow}>
          <Animated.View key={phase} entering={FADE_IN} exiting={FADE_OUT}>
            <Text variant="label" color={light.inkFaint}>
              {STATUS[phase]}
            </Text>
          </Animated.View>
          {result ? (
            <Text variant="data">
              Found {shown} {shown === 1 ? 'place' : 'places'}
              {phase === 'done' && result ? ` in ${result.city.name}` : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.credits}>
          {result?.places.slice(0, shown).map((p) => (
            <Animated.View key={p.id} entering={CREDIT_IN} style={styles.creditRow}>
              <Text variant="serifItalic" style={styles.creditName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="micro">{p.area}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      {phase === 'done' && result ? (
        <View style={[styles.choice, { paddingBottom: insets.bottom + 12 }]}>
          {result.places.length === 1 ? (
            <Animated.View entering={CHOICE_ENTER[0]}>
              <Text variant="bodyStrong" style={styles.center}>
                {result.places[0].name} added to {result.city.name}
              </Text>
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={CHOICE_ENTER[0]}>
                <Button
                  label={
                    existed
                      ? `Add ${result.places.length} spots to ${result.city.name}`
                      : `Save ${result.places.length} spots`
                  }
                  onPress={() => router.back()}
                  accessibilityHint="Keeps collecting. Back to your cities."
                />
              </Animated.View>
              <Animated.View entering={CHOICE_ENTER[1]}>
                <Button kind="text" label="Plan this trip" trailingArrow onPress={planTrip} />
              </Animated.View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

// A soft band of light crossing the thumbnail while the link is being read.
function Shimmer({ width, active }: { width: number; active: boolean }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-160);
  const on = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    x.set(withRepeat(withTiming(width + 160, { duration: 1400, easing: Easing.linear }), -1, false));
  }, [reduced, width, x]);
  useEffect(() => {
    on.set(withTiming(active ? 1 : 0, { duration: 300 }));
  }, [active, on]);
  const style = useAnimatedStyle(() => ({
    opacity: on.get(),
    transform: [{ translateX: x.get() }, { rotate: '18deg' }],
  }));
  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.shimmer, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  close: { marginLeft: 16 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  previewText: { position: 'absolute', left: 18, right: 18, bottom: 16, gap: 6 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shimmer: { position: 'absolute', top: -60, bottom: -60, width: 120 },
  statusRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  credits: { marginTop: 18, gap: 10 },
  creditRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  creditName: { flexShrink: 1 },
  choice: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 4 },
  center: { textAlign: 'center', paddingBottom: 12 },
});
