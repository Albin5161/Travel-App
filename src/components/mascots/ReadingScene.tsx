import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { dressFor, type Dress } from '@/lib/dress';
import { radii } from '@/theme/tokens';

import type { Prop } from './figures';
import { BUBBLE, BUBBLE_INK, motion } from './motion';
import { PICTURES, type Pose } from './pictures';

/** What the reading is doing, as the scene tells it: the status line's steps, a long wait, the finds. */
export type Topic = 'play' | 'caption' | 'pin' | 'listen' | 'wait' | 'found';

export type Line = { who: 'amma' | 'kid'; text: string };

// Two lines a step, taking turns, then they fall quiet and watch. A few ways of saying each step,
// one picked per reading, so the tenth video doesn't sound like the first. English only for now.
const LINES: Record<Exclude<Topic, 'found'>, Line[][]> = {
  play: [
    [
      { who: 'kid', text: 'Amma, look at this reel!' },
      { who: 'amma', text: 'Ooh, show me!' },
    ],
    [
      { who: 'kid', text: 'Amma! Watch this one!' },
      { who: 'amma', text: 'Where is that? Let’s see.' },
    ],
    [
      { who: 'amma', text: 'What did you find now?' },
      { who: 'kid', text: 'A trip! Look, look!' },
    ],
  ],
  caption: [
    [
      { who: 'amma', text: 'Let’s read what it says.' },
      { who: 'kid', text: 'Does it say where?' },
    ],
    [
      { who: 'kid', text: 'What does the writing say?' },
      { who: 'amma', text: 'Reading it now…' },
    ],
  ],
  pin: [
    [
      { who: 'kid', text: 'Write the places down, Amma!' },
      { who: 'amma', text: 'Writing them down.' },
    ],
    [
      { who: 'amma', text: 'Let’s note these places.' },
      { who: 'kid', text: 'I’ll remember them too!' },
    ],
  ],
  listen: [
    [
      { who: 'amma', text: 'Shh… they’re saying names.' },
      { who: 'kid', text: 'I’m listening too!' },
    ],
    [
      { who: 'kid', text: 'Did they say a beach?' },
      { who: 'amma', text: 'Listening for the names.' },
    ],
  ],
  wait: [
    [
      { who: 'kid', text: 'Is it done yet?' },
      { who: 'amma', text: 'Good places take a moment.' },
    ],
    [
      { who: 'amma', text: 'This one’s a long video.' },
      { who: 'kid', text: 'I can wait. I think.' },
    ],
    [
      { who: 'kid', text: 'Amma, I’m getting hungry…' },
      { who: 'amma', text: 'Almost there. Then snacks.' },
    ],
  ],
};
const pick = <T,>(options: T[]) => options[Math.floor(Math.random() * options.length)];

/**
 * How long a line stays up: by its length, long enough to read it twice without hurrying ("Ooh,
 * show me!" 2.4 s, "Write the places down, Amma!" 3.3 s). Lines are never cut short, and a question
 * always gets its answer, however quickly the reading moves on.
 */
const lineMs = (line: Line) => Math.min(4200, Math.max(2400, 1200 + line.text.length * 75));
/** The cheer when the places arrive, before the scene steps aside for them. */
export const CHEER_MS = 2200;

// The scene is drawn on a 300 × 185 grid and scaled to the width it's given.
const W = 300;
const H = 185;
/** Where the picture sits: below the line of talk, its lower edge cut off by the card's. */
const PICTURE = { x: 18, y: 40, w: 264 };
/** Where their heads are, across the picture, for the bubbles' tails. */
const AMMA = { x: 112 };
const KID = { x: 186 };
const EDGE = 10;
/** The scene's height at a width. */
export const sceneHeight = (width: number) => (H * width) / W;

/**
 * Amma and the child watching the reel together while it's read: they talk about each step as it
 * really happens, and cheer when the places come back. With Reduce Motion on they hold still and
 * only the words change.
 */
// Memo: the loading screen re-renders four times a second for its clock, and none of that is news here.
export const ReadingScene = memo(function ReadingScene({
  topic,
  count,
  width,
  dress,
  onCheered,
}: {
  topic: Topic;
  count: number;
  width: number;
  /** The video's part of India, once its places are known (lib/dress). */
  dress?: Dress | null;
  onCheered: () => void;
}) {
  const { line, n, prev, current } = useChat(topic, count);
  // The scene's own step, which trails the reading's so every exchange is finished.
  const cheer = current === 'found';
  useCheer(cheer, onCheered);
  return (
    <Scene width={width} line={line} n={n} prev={prev} cheer={cheer} pose={current === 'wait' ? 'idle' : 'reading'} dress={dress} about="Amma and a child watch the video together." />
  );
});

/**
 * Amma and the child planning the trip while the plan is put together: a short script from the
 * traveller's own answers, then a cheer once the plan is back (`ready`). The last line holds until
 * it is.
 */
export const PlanningScene = memo(function PlanningScene({
  script,
  finale,
  ready,
  width,
  dress,
  onCheered,
}: {
  script: Line[];
  finale: Line;
  /** What the drawn pair had beside them; the 3D pictures carry their own. */
  prop?: Prop;
  ready: boolean;
  width: number;
  /** The trip's part of India (lib/dress). */
  dress?: Dress | null;
  onCheered: () => void;
}) {
  const { line, n, prev, cheer } = useScript(script, finale, ready);
  useCheer(cheer, onCheered);
  return <Scene width={width} line={line} n={n} prev={prev} cheer={cheer} pose="reading" dress={dress} about="Amma and a child plan the trip together." />;
});

/**
 * Amma and the child saying a few lines about the moment on screen (a wait, or something that went
 * wrong), then holding the last one. No cheer: nothing has been found. `worried` gives the child the
 * waiting face, for bad news.
 */
export const MascotMoment = memo(function MascotMoment({
  lines,
  width,
  worried = false,
  dress,
  about,
}: {
  lines: Line[];
  width: number;
  worried?: boolean;
  /** The video's part of India, when it was read far enough to know (lib/dress). */
  dress?: Dress | null;
  about: string;
}) {
  const script = useMemo(() => lines.slice(0, -1), [lines]);
  const last = lines[lines.length - 1];
  // The last line is the script's finale; its cheer is left out, and the line simply stays up.
  const { line, n, prev } = useScript(script, last, true);
  return <Scene width={width} line={line} n={n} prev={prev} cheer={false} pose={worried ? 'worried' : 'idle'} dress={dress} about={about} />;
});

/** The cheer holds CHEER_MS, then the scene steps aside. */
function useCheer(cheer: boolean, onCheered: () => void) {
  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(onCheered, CHEER_MS);
    return () => clearTimeout(t);
  }, [cheer, onCheered]);
}

/**
 * The picture: Amma and the child in 3D, dressed for the video's part of India (or yours), in the
 * pose for the moment, with whoever is talking in a bubble above them. Unlike the drawn pair they
 * don't blink or talk; they breathe, and hop when the places come back.
 */
function Scene({
  width,
  line,
  n,
  prev,
  cheer,
  pose,
  dress,
  about,
}: {
  width: number;
  line: Line | null;
  n: number;
  prev: Said | null;
  cheer: boolean;
  pose: Exclude<Pose, 'found'>;
  dress?: Dress | null;
  about: string;
}) {
  const reduced = useReducedMotion();
  const k = width / W;
  const picture = PICTURES[dressFor(dress)][cheer ? 'found' : pose];

  const said = line ? `${line.who === 'amma' ? 'Amma' : 'The child'} says: ${line.text}` : '';
  return (
    <View
      style={[styles.scene, { width, height: H * k }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${about} ${said}`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, !reduced && cheer && motion.hop]}>
        <Animated.View style={[StyleSheet.absoluteFill, !reduced && motion.ammaBreath]}>
          <Image
            source={picture}
            // One pose eases into the next rather than cutting.
            transition={reduced ? 0 : 220}
            contentFit="contain"
            style={{ position: 'absolute', left: PICTURE.x * k, top: PICTURE.y * k, width: PICTURE.w * k, height: ((PICTURE.w * 2) / 3) * k }}
            accessible={false}
          />
        </Animated.View>
      </Animated.View>

      {/* The line before fades as the next one pops in, so talk flows instead of blinking. */}
      {prev && !reduced ? <Bubble key={prev.n} line={prev.line} k={k} reduced={reduced} leaving /> : null}
      {line ? <Bubble key={n} line={line} k={k} reduced={reduced} /> : null}
    </View>
  );
}

type Said = { line: Line; n: number };
type Chat = { topic: Topic; i: number; n: number; since: number; line: Line | null; prev: Said | null };

/**
 * The talk, one line at a time, at a pace that can be read: each line stays up lineMs, a
 * question's answer always follows it, and only then does the scene move to the newest step
 * (skipping any it missed). After a step's lines they fall quiet until the next. The finds wait
 * for the exchange in progress too, then the cheer holds until the scene steps aside. `n` counts
 * showings; `prev` is the line just replaced, for its fade.
 */
function useChat(topic: Topic, count: number): { line: Line | null; n: number; prev: Said | null; current: Topic | null } {
  const [at, setAt] = useState<Chat | null>(null);
  const found = useMemo<Line>(() => ({ who: 'kid', text: `${count} ${count === 1 ? 'place' : 'places'}!` }), [count]);
  // One way of saying each step, chosen once for this reading.
  const [said] = useState(() => ({
    play: pick(LINES.play),
    caption: pick(LINES.caption),
    pin: pick(LINES.pin),
    listen: pick(LINES.listen),
    wait: pick(LINES.wait),
  }));

  useEffect(() => {
    if (at?.topic === 'found') return;
    const speaking = !!at?.line;
    // Quiet, with nothing new to say: wait for the reading to move on.
    if (!speaking && at?.topic === topic) return;
    const wait = speaking && at?.line ? Math.max(0, at.since + lineMs(at.line) - Date.now()) : 0;
    const t = setTimeout(() => {
      setAt((a) => {
        const n = (a?.n ?? 0) + 1;
        const prev = a?.line ? { line: a.line, n: a.n } : null;
        const since = Date.now();
        const lines = (of: Topic) => (of === 'found' ? [found] : said[of]);
        // The answer to what was just said.
        if (a && a.line && a.i + 1 < lines(a.topic).length) {
          return { topic: a.topic, i: a.i + 1, n, since, line: lines(a.topic)[a.i + 1], prev };
        }
        // The newest step, or quiet.
        if (!a || topic !== a.topic) return { topic, i: 0, n, since, line: lines(topic)[0], prev };
        return { ...a, n, since, line: null, prev };
      });
    }, wait);
    return () => clearTimeout(t);
  }, [at, topic, found, said]);

  return { line: at?.line ?? null, n: at?.n ?? 0, prev: at?.prev ?? null, current: at?.topic ?? null };
}

type Scripted = { i: number; n: number; since: number; line: Line; prev: Said | null };

/**
 * A fixed script, a line at a time at the same readable pace, then the finale (a cheer) once
 * `ready`. Until then the last line stays up.
 */
function useScript(script: Line[], finale: Line, ready: boolean): { line: Line | null; n: number; prev: Said | null; cheer: boolean } {
  const [at, setAt] = useState<Scripted | null>(null);
  useEffect(() => {
    const next = at ? at.i + 1 : 0;
    // The finale holds; and it waits for the plan.
    if (next > script.length || (next === script.length && !ready)) return;
    const wait = at ? Math.max(0, at.since + lineMs(at.line) - Date.now()) : 0;
    const t = setTimeout(() => {
      setAt((a) => ({
        i: next,
        n: (a?.n ?? 0) + 1,
        since: Date.now(),
        line: next === script.length ? finale : script[next],
        prev: a ? { line: a.line, n: a.n } : null,
      }));
    }, wait);
    return () => clearTimeout(t);
  }, [at, ready, script, finale]);
  return { line: at?.line ?? null, n: at?.n ?? 0, prev: at?.prev ?? null, cheer: !!at && at.i === script.length };
}

/** A speech bubble over whoever is talking, its tail pointing at them. */
function Bubble({ line, k, reduced, leaving }: { line: Line; k: number; reduced: boolean; leaving?: boolean }) {
  const amma = line.who === 'amma';
  // From the bubble's near edge to the speaker's head.
  const reach = (amma ? AMMA.x - EDGE : W - EDGE - KID.x) * k;
  return (
    <Animated.View
      style={[
        styles.bubble,
        amma ? { left: EDGE * k, transformOrigin: 'left bottom' } : { right: EDGE * k, transformOrigin: 'right bottom' },
        { top: 8 * k, maxWidth: (W - EDGE * 2) * k, minWidth: reach + 22 },
        !reduced && (leaving ? motion.fadeAway : motion.pop),
      ]}
      aria-hidden={leaving}
    >
      {/* One line, always: the room above the heads holds one line at 1.3× text, and no more. */}
      <Text variant="label" color={BUBBLE_INK} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {line.text}
      </Text>
      <View style={[styles.tail, amma ? { left: reach - 6 } : { right: reach - 6 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Straight on the glass, no panel of its own: its bottom edge is the card's, so the two are cut
  // off by the card like figures behind a window sill.
  scene: { alignSelf: 'center', overflow: 'hidden' },
  bubble: {
    position: 'absolute',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pane,
    backgroundColor: BUBBLE,
  },
  tail: {
    position: 'absolute',
    bottom: -5,
    width: 12,
    height: 12,
    backgroundColor: BUBBLE,
    transform: [{ rotate: '45deg' }],
  },
});
