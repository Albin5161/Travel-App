import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ReelScanner } from '@/components/motion/ReelScanner';
import { ReelTimeline, seconds } from '@/components/motion/ReelTimeline';
import { PhotoCard } from '@/components/PhotoCard';
import { Text } from '@/components/Text';
import { extractPlaces, getLinkPreview } from '@/data/api';
import { SAMPLE_LINK } from '@/data/catalog';
import type { Extraction, Place, Reel } from '@/data/types';
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
// One place per beat, slow enough that each marker's pop and each pin's drop read on their own.
const CREDIT_GAP_MS = 300;
const WATCH_MS = STAGES.length * STAGE_MS;
const CHOICE_ENTER = [0, 1].map((i) => fadeUp(i * 60));
const SCANNER = 132;
// Where the scanner's orb sits: on the card's bottom edge, near the right corner.
const ORB_INSET = 46;
// The timeline stops short of the scanner orb on the card's edge.
const TIMELINE_RIGHT = ORB_INSET + 36;

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
  // Places land in the order the video mentions them, so the list and the timeline agree.
  const found = useMemo(
    () => (result ? [...result.places].sort((a, b) => seconds(stampOf(a)) - seconds(stampOf(b))) : []),
    [result],
  );
  const markers = useMemo(() => {
    const length = seconds(preview?.duration) || 1;
    return found.map((p, i) => ({
      id: p.id,
      at: stampOf(p) ? clamp(seconds(stampOf(p)) / length) : (i + 1) / (found.length + 1),
    }));
  }, [found, preview?.duration]);
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
      const t = setTimeout(() => {
        haptic.selection();
        setShown((n) => n + 1);
      }, shown === 0 ? 360 : CREDIT_GAP_MS);
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
                  <View style={styles.timeline}>
                    <ReelTimeline
                      width={cardW - 18 - TIMELINE_RIGHT}
                      watching={!result}
                      markers={markers}
                      revealed={shown}
                      watchMs={WATCH_MS}
                    />
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
          <Animated.View key={status} entering={FADE_IN} exiting={FADE_OUT} style={styles.status}>
            <StageGlyph kind={phase === 'reading' ? STAGE_GLYPHS[stage] : phase === 'done' ? 'done' : 'pin'} />
            <Text variant="label" color={light.inkSoft} style={styles.statusText}>
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
          {found.slice(0, shown).map((p) => (
            <Animated.View key={p.id} entering={CREDIT_IN} style={styles.creditRow}>
              <PinDrop />
              <View style={styles.creditName}>
                <Text variant="title" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="micro" numberOfLines={1}>
                  {p.area}
                </Text>
              </View>
              {/* Where in the video it was said: the same moment its marker sits at above. */}
              <Text variant="data" color={light.inkFaint} style={styles.creditTime}>
                {stampOf(p) ?? ''}
              </Text>
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

function stampOf(p: Place) {
  return p.source.kind === 'reel' ? p.source.timestamp : undefined;
}

const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v));

type Glyph = 'play' | 'caption' | 'listen' | 'pin' | 'done';
const STAGE_GLYPHS: Glyph[] = ['play', 'caption', 'listen', 'pin'];

/** A small moving picture of the step in progress, so the status line is more than words. */
function StageGlyph({ kind }: { kind: Glyph }) {
  if (kind === 'listen') return <SoundBars />;
  const name = kind === 'play' ? 'play' : kind === 'caption' ? 'align-left' : kind === 'done' ? 'check' : 'map-pin';
  return (
    <View style={styles.glyph}>
      <Feather name={name} size={13} color={kind === 'done' ? light.ink : light.inkSoft} />
    </View>
  );
}

/** Three bars bobbing out of step: listening to the audio for place names. */
function SoundBars() {
  return (
    <View style={[styles.glyph, styles.bars]}>
      {[0, 1, 2].map((i) => (
        <Bar key={i} delay={i * 110} />
      ))}
    </View>
  );
}

function Bar({ delay }: { delay: number }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(0.4);
  useEffect(() => {
    if (reduced) return;
    h.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
            withTiming(0.35, { duration: 240, easing: Easing.in(Easing.quad) }),
          ),
          -1,
        ),
      ),
    );
  }, [delay, h, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.get() }] }));
  return <Animated.View style={[styles.bar, style]} />;
}

/** The pin each place arrives with: dropped from above, landing with a small bounce. */
function PinDrop() {
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : -14);
  useEffect(() => {
    if (!reduced) y.set(withSpring(0, { duration: 420, dampingRatio: 0.45 }));
  }, [reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={[styles.pin, style]}>
      <Feather name="map-pin" size={13} color={light.accent} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: light.canvas },
  close: { marginLeft: 16 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  // Right padding leaves room for the scanner sitting on the card's bottom-right edge.
  previewText: { position: 'absolute', left: 18, right: ORB_INSET + 28, bottom: 36, gap: 6 },
  timeline: { position: 'absolute', left: 18, bottom: 14 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  credits: { marginTop: 18, gap: 14 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creditTime: { flexShrink: 0 },
  creditName: { flex: 1, gap: 1 },
  pin: { width: 14, alignItems: 'center', alignSelf: 'flex-start', marginTop: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  glyph: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 2.5, height: 12, borderRadius: 1.5, backgroundColor: light.inkSoft },
  choice: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  center: { textAlign: 'center', paddingBottom: 12 },
  statusText: { flexShrink: 1 },
  scanner: { position: 'absolute', pointerEvents: 'none' },
});
