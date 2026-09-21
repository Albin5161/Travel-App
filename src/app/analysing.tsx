import { Feather, Ionicons } from '@expo/vector-icons';
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

import { PhotoCard } from '@/components/PhotoCard';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { extractPlaces, getLinkPreview } from '@/data/api';
import { SAMPLE_LINK } from '@/data/catalog';
import type { Extraction, Reel } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { CARD_IN, CREDIT_IN, FADE_IN, FADE_OUT } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { colors } from '@/theme/tokens';

type Phase = 'reading' | 'finding' | 'placing';
const STATUS: Record<Phase, string> = {
  reading: 'Reading the description…',
  finding: 'Finding places…',
  placing: 'Placing them on the map…',
};
const CREDIT_GAP_MS = 130;

export default function Analysing() {
  const { state, dispatch } = useTrips();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [url] = useState(() => state.pendingLink ?? SAMPLE_LINK);
  const [preview, setPreview] = useState<Reel | null>(null);
  const [result, setResult] = useState<Extraction | null>(null);
  const [shown, setShown] = useState(0);
  const cancelled = useRef(false);
  const phase: Phase = !result ? 'reading' : shown < result.places.length ? 'finding' : 'placing';

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

  // Roll the place names in like film credits, then hand off to the map.
  useEffect(() => {
    if (!result) return;
    if (shown < result.places.length) {
      const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 200 : CREDIT_GAP_MS);
      return () => clearTimeout(t);
    }
    haptic.success();
    dispatch({ type: 'commitExtraction', extraction: result });
    const t = setTimeout(() => {
      if (!cancelled.current) router.replace({ pathname: '/city/[id]', params: { id: result.city.id, reveal: '1' } });
    }, 900);
    return () => clearTimeout(t);
  }, [dispatch, result, shown]);

  const cardW = W - 48;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 8 }]}>
      <PressableScale onPress={() => router.back()} style={styles.close} accessibilityLabel="Cancel" accessibilityRole="button">
        <Feather name="x" size={20} color={colors.mist} />
      </PressableScale>

      <View style={styles.body}>
        {preview ? (
          <Animated.View entering={CARD_IN}>
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
          </Animated.View>
        ) : (
          <View style={{ width: cardW, height: cardW * 0.62 }} />
        )}

        <View style={styles.statusRow}>
          <Animated.View key={phase} entering={FADE_IN} exiting={FADE_OUT}>
            <Text variant="label" color={colors.ash}>
              {STATUS[phase]}
            </Text>
          </Animated.View>
          {result ? (
            <Text variant="data">
              Found {shown} {shown === 1 ? 'place' : 'places'}
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
  const style = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ translateX: x.get() }, { rotate: '18deg' }] }));
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
  fill: { flex: 1, backgroundColor: colors.night },
  close: {
    marginLeft: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  previewText: { position: 'absolute', left: 18, right: 18, bottom: 16, gap: 6 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shimmer: { position: 'absolute', top: -60, bottom: -60, width: 120 },
  statusRow: { marginTop: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 20 },
  credits: { marginTop: 18, gap: 10 },
  creditRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  creditName: { flexShrink: 1 },
});
