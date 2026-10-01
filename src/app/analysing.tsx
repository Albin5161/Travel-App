import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import Ionicons from '@/components/Ionicons';
import { MascotMoment, ReadingScene, sceneHeight, type Line, type Topic } from '@/components/mascots/ReadingScene';
import { ReelScanner } from '@/components/motion/ReelScanner';
import { ReelTimeline, seconds } from '@/components/motion/ReelTimeline';
import { GlassRim, PhotoCard } from '@/components/PhotoCard';
import { Glass } from '@/components/sky/Glass';
import { SkyScreen } from '@/components/sky/SkyScreen';
import { Text } from '@/components/Text';
import { extractPlaces, getLinkPreview, isSampleLink } from '@/data/api';
import { register } from '@/data/registry';
import { SAMPLE_LINK } from '@/data/catalog';
import type { Extraction, Place, Reel } from '@/data/types';
import { ApiFailure } from '@/lib/api';
import { platformOfLink, track } from '@/lib/analytics';
import { CHECK_AS_LIST_FROM, lengthLabel, readLink } from '@/lib/extract';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { CARD_IN, CREDIT_IN, FADE_IN, FADE_OUT, fadeUp } from '@/lib/motion';
import { parseLink } from '@/server/links';
import type { AssistReason } from '@/server/types';
import { useTrips } from '@/state/trips';
import { Tone } from '@/theme/tone';
import { skyAccentText, skyFill, skyInk } from '@/theme/sky';
import { colors, radii, space } from '@/theme/tokens';

type Phase = 'reading' | 'finding' | 'done';

/**
 * What the status line says while a link is read, step by step, at the moment each step really
 * starts on the server, and how long the whole read usually takes. Honest steps make a wait feel
 * like work. A sample plays from the catalog in a couple of seconds, so it keeps its quick, winking
 * steps; a real link gets the steps its platform actually goes through, and never stops on one that
 * isn't happening.
 */
type Script = {
  stages: { at: number; text: string; glyph: StepGlyph }[];
  /** How long reading usually takes: what the progress line eases toward. */
  expectMs: number;
  /** Said under the status, so nobody wonders whether it's stuck. */
  expect: string | null;
  /** Past the usual time, said instead: the clock and the promise never disagree. */
  late: { after: number; text: string } | null;
  /** Said in turn once the last step has run long. */
  still: string[];
};
const SAMPLE: Script = {
  stages: [
    { at: 0, text: 'Pressing play…', glyph: 'play' },
    { at: 700, text: 'Reading the caption. Skipping the hashtags.', glyph: 'caption' },
    { at: 1400, text: 'Listening for place names…', glyph: 'listen' },
    { at: 2100, text: 'Pinning them on a map…', glyph: 'pin' },
  ],
  expectMs: 2800,
  expect: null,
  late: null,
  still: [],
};
// YouTube: the title and description are read, then the AI lists the places. About 5–10 s.
const YOUTUBE: Script = {
  stages: [
    { at: 0, text: 'Opening the video…', glyph: 'play' },
    { at: 2000, text: 'Reading the title and description…', glyph: 'caption' },
    { at: 5000, text: 'Picking out the places…', glyph: 'pin' },
  ],
  expectMs: 10_000,
  expect: 'Usually about 10 seconds',
  late: { after: 15_000, text: 'Taking longer than usual. Hang on a little.' },
  still: ['Still reading. Long descriptions take a little longer.', 'Still on it. Nearly every video gets there.'],
};
// Instagram: the reel or photo post is opened through Apify (up to 45 s), its caption and comments
// read (and a post's pictures, about 10 s more), and if a reel's text names nothing, its audio is
// listened to as well (up to 100 s more). Which of the two it is isn't known until it's opened.
const INSTAGRAM: Script = {
  stages: [
    { at: 0, text: 'Opening it on Instagram…', glyph: 'play' },
    { at: 8000, text: 'Reading the caption, and the photos if it’s a post…', glyph: 'caption' },
    { at: 18_000, text: 'Picking out the places…', glyph: 'pin' },
    { at: 40_000, text: 'Listening to the reel, in case the places are only said out loud…', glyph: 'listen' },
  ],
  expectMs: 35_000,
  expect: 'Instagram reels usually take 20–45 seconds',
  late: { after: 45_000, text: 'Longer than usual: this one needs listening to. Up to two minutes.' },
  still: ['Still listening. Long reels take up to two minutes.', 'Still on it. Places said out loud take longer to catch.'],
};
/** After the last step has run this long, the status says so instead of holding still. */
const STILL_AFTER_MS = 12_000;
const STILL_EVERY_MS = 8000;
/** How long the scene takes to fold away after the cheer: unhurried, it's the hand-off to the list. */
const FOLD_MS = 450;

const STATUS: Record<Exclude<Phase, 'reading'>, string> = {
  finding: 'Finding each one on the map…',
  done: 'All found',
};
// One place per beat, slow enough that each marker's pop and each pin's drop read on their own.
const CREDIT_GAP_MS = 300;
/** Names listed one by one; past this, the rest roll into a "+9 more" line, quicker. */
const CREDITS_SHOWN = 5;
const MORE_GAP_MS = 90;
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
  // Whether whoever pasted is still here: leaving (Keep browsing, or back) lets the reading finish
  // and wait on Home; the ✕ stops it.
  const away = useRef<Away>('here');
  const { preview, names, result, failure } = useReading(url, away);
  const [shown, setShown] = useState(0);
  const link = useMemo(() => parseLink(url), [url]);
  const script = isSampleLink(url) ? SAMPLE : link?.platform === 'instagram' ? INSTAGRAM : YOUTUBE;
  const early = useMemo(() => earlyReel(url), [url]);
  const card = preview ?? early;
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

  // The time since the paste, while nothing has come back: it moves the steps on, and is shown.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    sound.preload('found');
    if (names.length > 0) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(t);
  }, [names.length]);
  const stage = script.stages.reduce((at, s, i) => (elapsed >= s.at ? i : at), 0);
  const last = script.stages[script.stages.length - 1];
  const overdue = elapsed - last.at - STILL_AFTER_MS;
  const stillGoing = overdue >= 0 && script.still.length > 0;
  const reading = stillGoing
    ? { text: script.still[Math.floor(overdue / STILL_EVERY_MS) % script.still.length], glyph: last.glyph }
    : script.stages[stage];
  // Done, the status line is the count itself: "Found 9 places in Kochi", once, with its tick.
  const foundLine = result ? `Found ${result.places.length} ${result.places.length === 1 ? 'place' : 'places'} in ${result.city.name}` : null;
  const status = phase === 'reading' ? reading.text : phase === 'done' && foundLine ? foundLine : STATUS[phase];

  // Amma and the child keep the wait company, talking through each step, and cheer the finds
  // before stepping aside for them.
  const late = stillGoing || (!!script.late && elapsed >= script.late.after);
  const topic: Topic = phase !== 'reading' ? 'found' : late ? 'wait' : reading.glyph;
  // After the cheer the scene folds away (height and opacity, once), then leaves.
  const [scene, setScene] = useState<'on' | 'leaving' | 'gone'>('on');
  const stepAside = useCallback(() => setScene('leaving'), []);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (scene !== 'leaving') return;
    const t = setTimeout(() => setScene('gone'), reduced ? 0 : FOLD_MS);
    return () => clearTimeout(t);
  }, [scene, reduced]);

  // Roll the place names in like film credits, as soon as they're known; matching them to real
  // places carries on underneath. When the last one lands and the matching is done, the work is
  // done: chime, haptic, and the extraction is held for checking. Nothing is saved until the user
  // confirms it. The names wait for Amma and the child to finish cheering: the scene is the wait's
  // payoff, and the list follows it.
  useEffect(() => {
    if (scene === 'on') return;
    if (shown < names.length) {
      const t = setTimeout(() => {
        haptic.selection();
        setShown((n) => n + 1);
      }, shown === 0 ? 360 : shown >= CREDITS_SHOWN ? MORE_GAP_MS : CREDIT_GAP_MS);
      return () => clearTimeout(t);
    }
    if (!result) return;
    haptic.success();
    void sound.play('found');
    dispatch({ type: 'stageExtraction', extraction: result });
  }, [dispatch, names.length, result, shown, scene]);

  const retry = () => {
    haptic.light();
    onRetry();
  };

  if (failure) {
    return <ReadFailed url={url} failure={failure} onRetry={retry} insetTop={insets.top} insetBottom={insets.bottom} />;
  }

  const check = () => {
    haptic.light();
    router.replace('/verify');
  };

  const cardW = W - space.screen * 2;
  const sceneW = Math.min(cardW - 28, 320);

  return (
    <SkyScreen style={{ paddingTop: insets.top + 8 }}>
      <IconButton
        icon="x"
        onPress={() => {
          // ✕ leaves the way Back does, so the two never differ: a read in progress carries on and
          // waits on Home, and places already found stay there as "Continue planning".
          if (phase !== 'done') away.current = 'left';
          router.back();
        }}
        accessibilityLabel={phase === 'done' ? 'Close. The places wait on Home.' : 'Close. Reading carries on, and the places will wait on Home.'}
        style={styles.close}
      />

      <View style={styles.body}>
        <View>
          {card ? (
            <Animated.View entering={CARD_IN}>
              <Tone value="dark">
                <ReelCard reel={card} width={cardW} height={cardW * 0.62}>
                  <View style={styles.previewText}>
                    <View style={styles.sourceRow}>
                      <Ionicons
                        name={card.platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'}
                        size={14}
                        color={colors.mist}
                      />
                      <Text variant="micro" color={colors.mist}>
                        {[card.creator, lengthLabel(card)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {card.title ? (
                      <Animated.View key={card.title} entering={FADE_IN}>
                        <Text variant="bodyStrong" numberOfLines={2}>
                          {card.title}
                        </Text>
                      </Animated.View>
                    ) : null}
                  </View>
                  <View style={styles.timeline}>
                    <ReelTimeline
                      width={cardW - 18 - TIMELINE_RIGHT}
                      watching={!result}
                      markers={markers}
                      revealed={shown}
                      watchMs={script.expectMs}
                    />
                  </View>
                </ReelCard>
              </Tone>
            </Animated.View>
          ) : (
            <View style={{ width: cardW, height: cardW * 0.62 }} />
          )}
          <View style={[styles.scanner, { left: cardW - ORB_INSET - SCANNER / 2, top: cardW * 0.62 - SCANNER / 2 }]}>
            <ReelScanner done={phase === 'done'} size={SCANNER} />
          </View>
        </View>

        {/* The finds on one pane of glass: what's happening in its header, a row per place. */}
        <Glass style={styles.found}>
        <View style={styles.statusRow}>
          <Animated.View key={status} entering={FADE_IN} exiting={FADE_OUT} style={styles.status}>
            <StageGlyph kind={phase === 'reading' ? reading.glyph : phase === 'done' ? 'done' : 'pin'} />
            <Text variant="label" style={styles.statusText}>
              {status}
            </Text>
          </Animated.View>
          {/* The count starts with the first name in the list, not while the scene still cheers. */}
          {phase === 'done' ? null : shown > 0 ? (
            <Text variant="data">{`Found ${shown} ${shown === 1 ? 'place' : 'places'}`}</Text>
          ) : script.expect ? (
            // A running clock: a wait that visibly moves reads as work, not as stuck.
            <Text variant="data" color={skyInk.soft} accessibilityLabel={`${Math.floor(elapsed / 1000)} seconds so far`}>
              {clock(elapsed)}
            </Text>
          ) : null}
        </View>
        {phase === 'reading' && script.expect ? (
          <Text variant="label" color={skyInk.soft} style={styles.expect}>
            {script.late && elapsed >= script.late.after ? script.late.text : script.expect}
          </Text>
        ) : null}

        {/* Scrolls inside the card when a short screen (a phone browser, with its bars) can't fit
            every row above the button. */}
        <ScrollView style={styles.creditsScroll} contentContainerStyle={styles.credits} showsVerticalScrollIndicator={false}>
          {found.slice(0, Math.min(shown, CREDITS_SHOWN)).map((p) => {
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
                <Text variant="data" color={skyInk.faint} style={styles.creditTime}>
                  {p.stamp ?? ''}
                </Text>
              </Animated.View>
            );
          })}
          {shown > CREDITS_SHOWN ? <MoreCredits rest={found.slice(CREDITS_SHOWN, shown)} placed={placed} done={!!result} /> : null}
        </ScrollView>
        {/* Last in the card, so its bottom edge crops them; the finds roll in above. */}
        {scene === 'gone' ? null : (
          <Animated.View
            style={[
              styles.scene,
              scene === 'leaving' ? styles.sceneFolded : { maxHeight: sceneHeight(sceneW) },
              !reduced && styles.sceneFold,
            ]}
          >
            <ReadingScene topic={topic} count={names.length} width={sceneW} onCheered={stepAside} />
          </Animated.View>
        )}
        </Glass>
      </View>


      {phase === 'done' && result ? (
        <View style={[styles.choice, { paddingBottom: insets.bottom + 12 }]}>
          <Animated.View entering={CHOICE_ENTER[0]}>
            <Text variant="label" color={skyInk.soft} style={styles.center}>
              {result.places.length >= CHECK_AS_LIST_FROM
                ? 'Next, untick any we got wrong.'
                : 'Next, swipe through them: right if we got it right.'}
            </Text>
          </Animated.View>
          <Animated.View entering={CHOICE_ENTER[1]}>
            <Button
              trailingArrow
              label={result.places.length === 1 ? 'Check this place' : `Check ${result.places.length} places`}
              onPress={check}
              accessibilityHint="Confirm each place before it's saved"
            />
          </Animated.View>
        </View>
      ) : null}
    </SkyScreen>
  );
}

/** Whether whoever pasted is still on the screen, left it to carry on, or stopped the read. */
type Away = 'here' | 'left' | 'stopped';

/**
 * The video as far as the link alone says, so the card is there from the first moment instead of
 * a gap: a YouTube link names its video, whose thumbnail is public; an Instagram link gives nothing
 * to show yet, so its card is the reel's shape with Instagram's mark. The real details replace it.
 */
function earlyReel(url: string): Reel | null {
  if (isSampleLink(url)) return null;
  const link = parseLink(url);
  if (!link) return null;
  return link.platform === 'youtube'
    ? { id: `yt:${link.videoId}`, platform: 'youtube', creator: 'YouTube video', title: '', duration: '', thumbnail: { uri: `https://i.ytimg.com/vi/${link.videoId}/hqdefault.jpg` }, cityId: '', placeIds: [] }
    : { id: `ig:${link.shortcode}`, platform: 'instagram', creator: 'Instagram reel', title: '', duration: '', thumbnail: 0, cityId: '', placeIds: [] };
}

/** "0:07": the wait so far. */
function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The video's card: its picture when there is one, else the reel's shape with its platform's mark. */
function ReelCard({ reel, width, height, children }: { reel: Reel; width: number; height: number; children: ReactNode }) {
  if (reel.thumbnail) {
    return (
      // The deeper shade: the creator and title sit higher than a city card's name does.
      <PhotoCard source={reel.thumbnail} gradient="pick" style={{ width, height }}>
        {children}
      </PhotoCard>
    );
  }
  return (
    <View style={[styles.blankCard, { width, height }]}>
      <View style={styles.blankMark} pointerEvents="none">
        <Ionicons name={reel.platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={56} color={colors.mist} />
      </View>
      {children}
      <GlassRim radius={radii.card} />
    </View>
  );
}

/** A name in the rolling list: known before it's matched to a real place. */
type Credit = { id: string; name: string; area: string; stamp?: string };

type Failure =
  | { kind: 'error'; error: ApiFailure }
  | { kind: 'empty'; reel: Reel | null; region: string | null }
  | { kind: 'assist'; reason: AssistReason; reel: Reel; region: string | null };

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
function useReading(url: string, away: RefObject<Away>) {
  const { dispatch } = useTrips();
  const [preview, setPreview] = useState<Reel | null>(null);
  const [names, setNames] = useState<Credit[]>([]);
  const [result, setResult] = useState<Extraction | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    let cancelled = false;
    // How long the wait was, and how each read ended: the numbers behind "does pasting work?".
    const startedAt = Date.now();
    const measure = { platform: platformOfLink(url), example: isSampleLink(url) };
    const took = () => Math.round((Date.now() - startedAt) / 1000);
    const failed = (reason: string) => track('link failed', { ...measure, reason, seconds: took() });
    const done = (r: Extraction) => {
      if (cancelled) {
        // Read after its screen was left (not stopped): it waits on Home as places to check.
        if (away.current !== 'left') return;
        track('places found', { ...measure, count: r.places.length, seconds: took(), away: true });
        haptic.success();
        void sound.play('found');
        dispatch({ type: 'readInBackground', url, extraction: r });
        return;
      }
      track('places found', { ...measure, count: r.places.length, seconds: took() });
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
          else if (outcome.kind === 'empty') {
            failed('empty');
            setFailure({ kind: 'empty', reel: outcome.reel, region: outcome.region });
          } else {
            failed(outcome.reason);
            setFailure({ kind: 'assist', reason: outcome.reason, reel: outcome.reel, region: outcome.region });
          }
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          const error =
            e instanceof ApiFailure ? e : new ApiFailure('upstream', 'Something went wrong on our side. Try again.', true);
          failed(error.code);
          setFailure({ kind: 'error', error });
        });
    }
    return () => {
      cancelled = true;
      // Gone without the ✕ (Keep browsing, a swipe back): the reading carries on.
      if (away.current === 'here') away.current = 'left';
    };
  }, [url, away, dispatch]);

  return { preview, names, result, failure };
}

/** The names past the first few, as one line: "+9 more places", and how many weren't found. */
function MoreCredits({ rest, placed, done }: { rest: Credit[]; placed: Set<string>; done: boolean }) {
  const missing = done ? rest.filter((p) => !placed.has(p.name.toLowerCase())).length : 0;
  return (
    <Animated.View entering={CREDIT_IN} style={styles.creditRow}>
      <View style={styles.moreDot}>
        <Text variant="data" color={skyInk.soft}>
          +{rest.length}
        </Text>
      </View>
      <View style={styles.creditName}>
        <Text variant="title" numberOfLines={1}>
          {rest.length} more {rest.length === 1 ? 'place' : 'places'}
        </Text>
        <Text variant="micro" numberOfLines={1}>
          {missing > 0
            ? `${missing} couldn’t be found on the map`
            : rest
                .slice(0, 3)
                .map((p) => p.name)
                .join(', ') + (rest.length > 3 ? '…' : '')}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * When a link doesn't turn into places: what happened, in plain words, and what to do next. "Try
 * again" only where trying again can help (our side or the connection), never for the link itself.
 */
function ReadFailed({
  url,
  failure,
  onRetry,
  insetTop,
  insetBottom,
}: {
  url: string;
  failure: Failure;
  onRetry: () => void;
  insetTop: number;
  insetBottom: number;
}) {
  const { dispatch } = useTrips();
  const { width: W } = useWindowDimensions();
  const copy = failureCopy(failure);
  const canRetry = failure.kind === 'error' && failure.error.retryable;
  // A reel we couldn't read can still be saved: the person watches it and adds what they spot. A
  // video about a city that names no places in it gets the city's best-known spots to pick from.
  const reel = failure.kind === 'assist' || failure.kind === 'empty' ? failure.reel : null;
  const region = failure.kind === 'assist' || failure.kind === 'empty' ? failure.region : null;
  const city = cityOf(region);
  const canAdd = failure.kind === 'assist' || (failure.kind === 'empty' && !!reel && !!city);
  const addYourself = () => {
    if (!reel) return;
    haptic.light();
    register({ reel });
    router.replace({ pathname: '/addplaces', params: { reel: reel.id, url, ...(city && region ? { region } : {}) } });
  };
  const another = () => {
    haptic.light();
    dispatch({ type: 'setDraft', draft: null });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <SkyScreen style={{ paddingTop: insetTop + 8 }}>
      <IconButton icon="x" onPress={another} accessibilityLabel="Close" style={styles.close} />
      <Animated.View entering={fadeUp(0)} style={styles.failed}>
        {/* Amma and the child say what happened, the same two who kept the wait company. */}
        <Glass style={styles.failedScene}>
          <MascotMoment lines={failureLines(failure, city)} width={Math.min(W - space.screen * 2 - 28, 320)} worried about="Amma and the child look at the video." />
        </Glass>
        <Text variant="headline" accessibilityRole="header">{copy.title}</Text>
        <Text variant="body">
          {copy.body}
        </Text>
      </Animated.View>
      <View style={[styles.choice, styles.failedActions, { paddingBottom: insetBottom + 12 }]}>
        {canRetry ? <Button label="Try again" onPress={onRetry} /> : null}
        {canAdd ? (
          <Button label={city ? `See ${city}’s best-known spots` : 'Add the places yourself'} onPress={addYourself} />
        ) : null}
        <Button
          label="Paste another link"
          kind={canRetry || canAdd ? 'secondary' : 'primary'}
          onPress={another}
        />
      </View>
    </SkyScreen>
  );
}

/** What Amma and the child say when a link doesn't turn into places: the child notices, Amma says what next. */
function failureLines(f: Failure, city: string | null): Line[] {
  const say = (kid: string, amma: string): Line[] => [
    { who: 'kid', text: kid },
    { who: 'amma', text: amma },
  ];
  if (f.kind === 'empty' || (f.kind === 'assist' && f.reason === 'no_places')) {
    return city ? say(`It’s all ${city}, Amma!`, 'No names, though. Let’s pick spots.') : say('It doesn’t say where!', 'Then we’ll add them ourselves.');
  }
  if (f.kind === 'assist') {
    if (f.reason === 'unreadable') return say('It won’t open, Amma.', 'Maybe it’s private. We’ll add them.');
    if (f.reason === 'daily_limit') return say('Can we read one more?', 'Not today. We’ll add them ourselves.');
    return say('Can we read this one?', 'Not yet. We’ll add them ourselves.');
  }
  const e = f.error;
  if (e.code === 'offline') return say('No internet, Amma!', 'Let’s wait for it to come back.');
  if (e.code === 'quota' || e.code === 'rate_limited') return say('Can we do another?', 'Let’s rest a little first.');
  if (e.code === 'video_unavailable') return say('It won’t play, Amma.', 'Maybe it’s private. Try another link.');
  if (e.code === 'unsupported_link' || e.code === 'bad_request') {
    return say('That’s not a video, Amma!', 'Let’s paste a reel or YouTube link.');
  }
  return say('Uh-oh, it stopped!', 'Let’s try that again.');
}

/** "Mumbai" from "Mumbai, Maharashtra, India"; null when the video's city isn't known. */
function cityOf(region: string | null): string | null {
  const first = region?.split(',')[0]?.trim();
  return first || null;
}

function failureCopy(f: Failure): { icon: keyof typeof Feather.glyphMap; title: string; body: string } {
  const city = f.kind === 'assist' || f.kind === 'empty' ? cityOf(f.region) : null;
  // Shown or said to be about a city, with no places named in it: say so, and offer the city.
  if (city && (f.kind === 'empty' || (f.kind === 'assist' && f.reason === 'no_places'))) {
    return {
      icon: 'map-pin',
      title: 'No places named',
      body: `This ${f.kind === 'assist' ? 'reel' : 'video'} is about ${city}, but it doesn’t name any places. Pick from ${city}’s best-known spots, or add the ones you spot.`,
    };
  }
  if (f.kind === 'empty') {
    return {
      icon: 'map-pin',
      title: 'No places to pin',
      body: 'We read this video, but it doesn’t name places we could find on a map. Try one that names where it goes.',
    };
  }
  if (f.kind === 'assist') {
    const body: Record<AssistReason, string> = {
      no_places: 'We read this reel, but it doesn’t say where it was filmed. Watch it and add the places you spot.',
      unreadable: 'We couldn’t open this reel. It may be private, or Instagram didn’t let us in this time. You can still add its places yourself.',
      daily_limit: 'We’ve read as many Instagram reels as we can today. You can add this one’s places yourself.',
      not_configured: 'We can’t read Instagram reels for you yet. Watch it and add the places you spot.',
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
/** A step of the reading: every glyph but the finish. */
type StepGlyph = Exclude<Glyph, 'done'>;

/** A small moving picture of the step in progress, so the status line is more than words. */
function StageGlyph({ kind }: { kind: Glyph }) {
  if (kind === 'listen') return <SoundBars />;
  const name = kind === 'play' ? 'play' : kind === 'caption' ? 'align-left' : kind === 'done' ? 'check' : 'map-pin';
  return (
    <View style={styles.glyph}>
      <Feather name={name} size={13} color={kind === 'done' ? skyAccentText : skyInk.soft} />
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
      <Feather name="map-pin" size={13} color={skyAccentText} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  close: { marginLeft: space.screen },
  body: { flex: 1, minHeight: 0, paddingHorizontal: space.screen, paddingTop: 28 },
  // Right padding leaves room for the scanner sitting on the card's bottom-right edge.
  previewText: { position: 'absolute', left: 18, right: ORB_INSET + 28, bottom: 36, gap: 6 },
  timeline: { position: 'absolute', left: 18, bottom: 14 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Shrinks to the room left above the button; its list scrolls inside.
  found: { marginTop: 26, padding: 14, flexShrink: 1, minHeight: 0 },
  creditsScroll: { flexShrink: 1 },
  // Down to the card's edge, through its padding. On a short screen it gives up its lower part (the
  // bodies; faces and words are at the top) well before the finds do.
  scene: { marginTop: 4, marginBottom: -14, flexShrink: 4, minHeight: 0, overflow: 'hidden' },
  sceneFolded: { maxHeight: 0, marginTop: 0, marginBottom: 0, opacity: 0 },
  sceneFold: {
    transitionProperty: ['maxHeight', 'marginTop', 'marginBottom', 'opacity'],
    transitionDuration: FOLD_MS,
    transitionTimingFunction: 'ease-in-out',
  },
  statusRow: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: skyInk.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  credits: { paddingTop: 12, gap: 8 },
  // Each find is a lighter pane inside the glass.
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.pane,
    backgroundColor: skyFill.pane,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: skyInk.line,
  },
  creditTime: { flexShrink: 0 },
  creditName: { flex: 1, gap: 1 },
  moreDot: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: skyInk.line },
  pin: { width: 14, alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  glyph: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 2.5, height: 12, borderRadius: 1.5, backgroundColor: skyInk.soft },
  // In the page's flow, under the list, so the two can never overlap.
  choice: { paddingHorizontal: space.screen, paddingTop: 12 },
  center: { textAlign: 'center', paddingBottom: 12 },
  statusText: { flexShrink: 1 },
  scanner: { position: 'absolute', pointerEvents: 'none' },
  missing: { opacity: 0.45 },
  expect: { paddingTop: 10 },
  // An Instagram reel before anything of it is known: the card's shape, its platform's mark faint in it.
  blankCard: { overflow: 'hidden', borderRadius: radii.card, backgroundColor: colors.basalt },
  blankMark: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 40, opacity: 0.35 },
  failed: { flex: 1, justifyContent: 'center', paddingHorizontal: space.screen, gap: 12, paddingBottom: 24 },
  // The scene sits on the glass, its bottom edge cut by the card's, as on the reading screen.
  failedScene: { alignItems: 'center', paddingTop: 12, overflow: 'hidden', marginBottom: 8 },
  failedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: skyFill.raised,
    marginBottom: 4,
  },
  failedActions: { gap: 10 },
});
