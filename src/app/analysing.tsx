import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { extractPlaces, getLinkPreview, isSampleLink } from '@/data/api';
import { SAMPLE_LINK } from '@/data/catalog';
import type { Extraction, Place, Reel } from '@/data/types';
import { ApiFailure } from '@/lib/api';
import { readLink } from '@/lib/extract';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { CARD_IN, CREDIT_IN, FADE_IN, FADE_OUT, fadeUp } from '@/lib/motion';
import type { AssistReason } from '@/server/types';
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
// A real link takes 5–15 s to read, so its steps are spread over that instead of rushing to the last.
const LIVE_STAGE_MS = 2600;
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
  const { state } = useTrips();
  const [url] = useState(() => state.pendingLink ?? SAMPLE_LINK);
  // "Try again" reads the link once more on a fresh screen, every step starting over.
  const [attempt, setAttempt] = useState(0);
  return <Reading key={attempt} url={url} onRetry={() => setAttempt((n) => n + 1)} />;
}

function Reading({ url, onRetry }: { url: string; onRetry: () => void }) {
  const { dispatch } = useTrips();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { preview, names, result, failure } = useReading(url);
  const [shown, setShown] = useState(0);
  const [stage, setStage] = useState(0);
  // Names land in the order the video mentions them, so the list and the timeline agree.
  const found = useMemo(() => [...names].sort((a, b) => seconds(a.stamp) - seconds(b.stamp)), [names]);
  const markers = useMemo(() => {
    const length = seconds(preview?.duration) || 1;
    return found.map((p, i) => ({
      id: p.id,
      at: p.stamp ? clamp(seconds(p.stamp) / length) : (i + 1) / (found.length + 1),
    }));
  }, [found, preview?.duration]);
  // A name that couldn't be put on the map stays in the list, marked, so nothing silently vanishes.
  const placed = useMemo(() => new Set(result?.places.map((p) => p.name.toLowerCase()) ?? []), [result]);
  const phase: Phase = names.length === 0 ? 'reading' : !result || shown < names.length ? 'finding' : 'done';
  const status = phase === 'reading' ? STAGES[stage] : STATUS[phase];

  // Step through the stages, holding on the last one if the extraction runs long.
  useEffect(() => {
    sound.preload();
    if (names.length > 0 || stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((n) => n + 1), isSampleLink(url) ? STAGE_MS : LIVE_STAGE_MS);
    return () => clearTimeout(t);
  }, [names.length, stage, url]);

  // Roll the place names in like film credits, as soon as they're known; matching them to real
  // places carries on underneath. When the last one lands and the matching is done, the work is
  // done: chime, haptic, and the extraction is held for checking. Nothing is saved until the user
  // confirms it.
  useEffect(() => {
    if (shown < names.length) {
      const t = setTimeout(() => {
        haptic.selection();
        setShown((n) => n + 1);
      }, shown === 0 ? 360 : CREDIT_GAP_MS);
      return () => clearTimeout(t);
    }
    if (!result) return;
    haptic.success();
    void sound.done();
    dispatch({ type: 'stageExtraction', extraction: result });
  }, [dispatch, names.length, result, shown]);

  const retry = () => {
    haptic.light();
    onRetry();
  };

  if (failure) {
    return <ReadFailed failure={failure} onRetry={retry} insetTop={insets.top} insetBottom={insets.bottom} />;
  }

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
          {names.length > 0 ? (
            <Text variant="data">
              {phase === 'done' && result
                ? `Found ${result.places.length} ${result.places.length === 1 ? 'place' : 'places'} in ${result.city.name}`
                : `Found ${shown} ${shown === 1 ? 'place' : 'places'}`}
            </Text>
          ) : null}
        </View>

        <View style={styles.credits}>
          {found.slice(0, shown).map((p) => {
            const missing = !!result && !placed.has(p.name.toLowerCase());
            return (
              <Animated.View key={p.id} entering={CREDIT_IN} style={[styles.creditRow, missing && styles.missing]}>
                {missing ? <View style={styles.pin} /> : <PinDrop />}
                <View style={styles.creditName}>
                  <Text variant="title" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="micro" numberOfLines={1}>
                    {missing ? 'Couldn’t find it on the map' : p.area}
                  </Text>
                </View>
                {/* Where in the video it was said: the same moment its marker sits at above. */}
                <Text variant="data" color={light.inkFaint} style={styles.creditTime}>
                  {p.stamp ?? ''}
                </Text>
              </Animated.View>
            );
          })}
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

/** A name in the rolling list: known before it's matched to a real place. */
type Credit = { id: string; name: string; area: string; stamp?: string };

type Failure =
  | { kind: 'error'; error: ApiFailure }
  | { kind: 'empty' }
  | { kind: 'assist'; reason: AssistReason };

const creditOf = (p: Place, i: number): Credit => ({
  id: p.id || `n${i}`,
  name: p.name,
  area: p.area,
  stamp: p.source.kind === 'reel' ? p.source.timestamp || undefined : undefined,
});

/**
 * The link, read. Sample links play from the catalog; anything else goes to the API, and its place
 * names arrive (`names`) before they're matched to real places (`result`).
 */
function useReading(url: string) {
  const [preview, setPreview] = useState<Reel | null>(null);
  const [names, setNames] = useState<Credit[]>([]);
  const [result, setResult] = useState<Extraction | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    let cancelled = false;
    const done = (r: Extraction) => {
      if (cancelled) return;
      setPreview(r.reel);
      setNames((n) => (n.length ? n : r.places.map(creditOf)));
      setResult(r);
    };

    if (isSampleLink(url)) {
      getLinkPreview(url).then((p) => !cancelled && setPreview(p));
      extractPlaces(url).then(done);
    } else {
      readLink(url, (reel, found) => {
        if (cancelled) return;
        setPreview(reel);
        setNames(found.map((f, i) => ({ id: `n${i}`, name: f.name, area: f.area ?? '', stamp: f.timestamp ?? undefined })));
      })
        .then((outcome) => {
          if (cancelled) return;
          if (outcome.kind === 'done') done(outcome.extraction);
          else setFailure(outcome.kind === 'empty' ? { kind: 'empty' } : { kind: 'assist', reason: outcome.reason });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          const error =
            e instanceof ApiFailure ? e : new ApiFailure('upstream', 'Something went wrong on our side. Try again.', true);
          setFailure({ kind: 'error', error });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { preview, names, result, failure };
}

/**
 * When a link doesn't turn into places: what happened, in plain words, and what to do next. "Try
 * again" only where trying again can help (our side or the connection), never for the link itself.
 */
function ReadFailed({
  failure,
  onRetry,
  insetTop,
  insetBottom,
}: {
  failure: Failure;
  onRetry: () => void;
  insetTop: number;
  insetBottom: number;
}) {
  const copy = failureCopy(failure);
  const canRetry = failure.kind === 'error' && failure.error.retryable;
  const another = () => {
    haptic.light();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View style={[styles.fill, { paddingTop: insetTop + 8 }]}>
      <IconButton icon="x" onPress={another} accessibilityLabel="Close" style={styles.close} />
      <Animated.View entering={fadeUp(0)} style={styles.failed}>
        <View style={styles.failedIcon}>
          <Feather name={copy.icon} size={22} color={light.ink} />
        </View>
        <Text variant="headline">{copy.title}</Text>
        <Text variant="body" color={light.inkSoft}>
          {copy.body}
        </Text>
      </Animated.View>
      <View style={[styles.choice, styles.failedActions, { paddingBottom: insetBottom + 12 }]}>
        {canRetry ? <Button label="Try again" onPress={onRetry} /> : null}
        <Button label="Paste another link" kind={canRetry ? 'secondary' : 'primary'} onPress={another} />
      </View>
    </View>
  );
}

function failureCopy(f: Failure): { icon: keyof typeof Feather.glyphMap; title: string; body: string } {
  if (f.kind === 'empty') {
    return {
      icon: 'map-pin',
      title: 'No places to pin',
      body: 'We read this video, but it doesn’t name places we could find on a map. Try one that names where it goes.',
    };
  }
  if (f.kind === 'assist') {
    const body: Record<AssistReason, string> = {
      no_places: 'We read this reel, but it doesn’t say where it was filmed. Reels that name their spots in the caption work best.',
      unreadable: 'We couldn’t open this reel. It may be private or deleted, or Instagram didn’t let us in this time.',
      daily_limit: 'We’ve read as many Instagram reels as we can today. Try again tomorrow, or paste a YouTube link.',
      not_configured: 'Reading Instagram reels isn’t switched on yet. YouTube links work.',
    };
    return { icon: 'instagram', title: 'We couldn’t find the places', body: body[f.reason] };
  }
  const e = f.error;
  if (e.code === 'quota' || e.code === 'rate_limited') return { icon: 'clock', title: 'Let’s pause here', body: e.message };
  if (e.code === 'offline') return { icon: 'wifi-off', title: 'You’re offline', body: e.message };
  if (e.code === 'unsupported_link' || e.code === 'video_unavailable' || e.code === 'bad_request') {
    return { icon: 'link-2', title: 'That link didn’t work', body: e.message };
  }
  return { icon: 'alert-circle', title: 'Something went wrong', body: e.message };
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
  missing: { opacity: 0.45 },
  failed: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12, paddingBottom: 120 },
  failedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.canvasTop,
    marginBottom: 4,
  },
  failedActions: { gap: 10 },
});
