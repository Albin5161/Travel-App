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
import { ReelScanner } from '@/components/motion/ReelScanner';
import { PhotoCard } from '@/components/PhotoCard';
import { Text } from '@/components/Text';
import { extractPlaces, getLinkPreview } from '@/data/api';
import { SAMPLE_LINK } from '@/data/catalog';
import type { Extraction, Reel } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { CARD_IN, CREDIT_IN, FADE_IN, FADE_OUT, fadeUp } from '@/lib/motion';
import { useTrips } from '@/state/trips';
import { Tone } from '@/theme/tone';
import { colors, light } from '@/theme/tokens';

type Phase = 'reading' | 'finding' | 'done';
// While the link is being read, the status line walks through what the extraction actually does,
// in order, one step per beat. Honest steps make a wait feel like work; the wink keeps it light.
const STAGES = [
  'Pressing play…',
  'Reading the caption. Skipping the hashtags.',
  'Listening for place names…',
  'Pinning them on a map…',
];
const STAGE_MS = 700;
const STATUS: Record<Exclude<Phase, 'reading'>, string> = {
  finding: 'Writing them down…',
  done: 'All found',
};
const CREDIT_GAP_MS = 130;
const CHOICE_ENTER = [0, 1].map((i) => fadeUp(i * 60));
const SCANNER = 132;
// Where the scanner's orb sits: on the card's bottom edge, near the right corner.
const ORB_INSET = 46;

export default function Analysing() {
  const { state, dispatch } = useTrips();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [url] = useState(() => state.pendingLink ?? SAMPLE_LINK);
  const [preview, setPreview] = useState<Reel | null>(null);
  const [result, setResult] = useState<Extraction | null>(null);
  const [shown, setShown] = useState(0);
  const [stage, setStage] = useState(0);
  const cancelled = useRef(false);
  const phase: Phase = !result ? 'reading' : shown < result.places.length ? 'finding' : 'done';
  const status = phase === 'reading' ? STAGES[stage] : STATUS[phase];

  // Step through the stages, holding on the last one if the extraction runs long.
  useEffect(() => {
    sound.preload();
    if (result || stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((n) => n + 1), STAGE_MS);
    return () => clearTimeout(t);
  }, [result, stage]);

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

  // Roll the place names in like film credits. When the last one lands, the work is done: chime,
  // haptic, and the extraction is held for checking. Nothing is saved until the user confirms it.
  useEffect(() => {
    if (!result) return;
    if (shown < result.places.length) {
      const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 200 : CREDIT_GAP_MS);
      return () => clearTimeout(t);
    }
    haptic.success();
    void sound.done();
    dispatch({ type: 'stageExtraction', extraction: result });
  }, [dispatch, result, shown]);

  const check = () => {
    haptic.light();
    router.replace('/verify');
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
        <View>
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
          <View style={[styles.scanner, { left: cardW - ORB_INSET - SCANNER / 2, top: cardW * 0.62 - SCANNER / 2 }]}>
            <ReelScanner done={phase === 'done'} size={SCANNER} />
          </View>
        </View>

        <View style={styles.statusRow}>
          <Animated.View key={status} entering={FADE_IN} exiting={FADE_OUT} style={styles.statusText}>
            <Text variant="label" color={light.inkFaint}>
              {status}
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
              <Text variant="title" style={styles.creditName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="micro">{p.area}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      {phase === 'done' && result ? (
        <View style={[styles.choice, { paddingBottom: insets.bottom + 12 }]}>
          <Animated.View entering={CHOICE_ENTER[0]}>
            <Text variant="label" color={light.inkSoft} style={styles.center}>
              Swipe through them. Right if we got it right.
            </Text>
          </Animated.View>
          <Animated.View entering={CHOICE_ENTER[1]}>
            <Button
              label={result.places.length === 1 ? 'Check this place' : `Check ${result.places.length} places`}
              onPress={check}
              accessibilityHint="Confirm each place before it's saved"
            />
          </Animated.View>
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
  // Right padding leaves room for the scanner sitting on the card's bottom-right edge.
  previewText: { position: 'absolute', left: 18, right: ORB_INSET + 28, bottom: 16, gap: 6 },
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
  choice: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  center: { textAlign: 'center', paddingBottom: 12 },
  statusText: { flexShrink: 1 },
  scanner: { position: 'absolute', pointerEvents: 'none' },
});
