import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { Text } from '@/components/Text';
import { radii } from '@/theme/tokens';

import {
  AMMA_BODY,
  AMMA_HEAD_BOX,
  AmmaBody,
  KID_BODY,
  KID_HEAD_BOX,
  KidArm,
  KidBody,
  Phone,
  ammaHead,
  kidHead,
  type HeadLayers,
  type Mood,
} from './figures';
import { BUBBLE, BUBBLE_INK, motion } from './motion';

/** What the reading is doing, as the scene tells it: the status line's steps, a long wait, the finds. */
export type Topic = 'play' | 'caption' | 'pin' | 'listen' | 'wait' | 'found';

type Line = { who: 'amma' | 'kid'; text: string };

// Two lines a step, taking turns, then they fall quiet and watch. English only for now.
const LINES: Record<Exclude<Topic, 'found'>, Line[]> = {
  play: [
    { who: 'kid', text: 'Amma, look at this reel!' },
    { who: 'amma', text: 'Ooh, show me!' },
  ],
  caption: [
    { who: 'amma', text: 'Let’s read what it says.' },
    { who: 'kid', text: 'Does it say where?' },
  ],
  pin: [
    { who: 'kid', text: 'Write the places down, Amma!' },
    { who: 'amma', text: 'Writing them down.' },
  ],
  listen: [
    { who: 'amma', text: 'Shh… they’re saying the names.' },
    { who: 'kid', text: 'I’m listening too!' },
  ],
  wait: [
    { who: 'kid', text: 'Is it done yet?' },
    { who: 'amma', text: 'Good places take a moment.' },
  ],
};
/** How long each line stays up before the other answers. */
const LINE_MS = 2800;
/** A line is never cut short before it can be read, however quickly the steps move on. */
const MIN_LINE_MS = 1400;
/** The cheer when the places arrive, before the scene steps aside for them. */
export const CHEER_MS = 1400;

// The scene is drawn on a 300 × 185 grid and scaled to the width it's given.
const W = 300;
const H = 185;
const AMMA = { x: 96, y: 92 };
const KID = { x: 222, y: 118 };
const PHONE = { x: 166, y: 150 };
const EDGE = 10;

/**
 * Amma and the child watching the reel together while it's read: they talk about each step as it
 * really happens, and cheer when the places come back. With Reduce Motion on they hold still and
 * only the words change.
 */
export function ReadingScene({ topic, count, width, onCheered }: { topic: Topic; count: number; width: number; onCheered: () => void }) {
  const reduced = useReducedMotion();
  const k = width / W;
  const line = useChat(topic, count);
  const talking = useTalking(line);
  const cheer = topic === 'found';

  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(onCheered, CHEER_MS);
    return () => clearTimeout(t);
  }, [cheer, onCheered]);

  const ammaMood: Mood = cheer ? 'cheer' : 'idle';
  const kidMood: Mood = cheer ? 'cheer' : topic === 'wait' ? 'wait' : 'idle';
  const ammaTalks = talking?.who === 'amma';
  const kidTalks = talking?.who === 'kid';
  // Heads lean in to the phone, lift a little to speak, and tip back to cheer.
  const ammaTilt = cheer ? -4 : ammaTalks ? 3 : 7;
  const kidTilt = cheer ? 6 : kidTalks ? -4 : topic === 'wait' ? -2 : -9;
  const ammaFace = useMemo(() => ammaHead(ammaMood, 1.5), [ammaMood]);
  const kidFace = useMemo(() => kidHead(kidMood, -1.5), [kidMood]);

  const said = line ? `${line.who === 'amma' ? 'Amma' : 'The child'} says: ${line.text}` : '';
  return (
    <View
      style={[styles.scene, { width, height: H * k }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Amma and a child watch the video together. ${said}`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, !reduced && motion.glow]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <RadialGradient id="mascotGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFD6BE" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFD6BE" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={PHONE.x - 6} cy={PHONE.y - 10} rx={46} ry={40} fill="url(#mascotGlow)" />
        </Svg>
      </Animated.View>

      {/* Amma, then the phone in her hand, then the child leaning in to point at it. */}
      <Animated.View style={[StyleSheet.absoluteFill, !reduced && motion.ammaBreath]}>
        <Body at={AMMA} box={AMMA_BODY} k={k}>
          <AmmaBody />
        </Body>
        <Head layers={ammaFace} at={AMMA} box={AMMA_HEAD_BOX} k={k} tilt={ammaTilt} talking={ammaTalks} who="amma" reduced={reduced} cheer={cheer} />
      </Animated.View>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <Phone x={PHONE.x} y={PHONE.y} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, !reduced && cheer && motion.hop]}>
        <Animated.View style={[StyleSheet.absoluteFill, !reduced && motion.kidBreath]}>
          <Body at={KID} box={KID_BODY} k={k}>
            <KidBody />
          </Body>
          <Head layers={kidFace} at={KID} box={KID_HEAD_BOX} k={k} tilt={kidTilt} talking={kidTalks} who="kid" reduced={reduced} cheer={cheer} />
          {cheer ? null : (
            <Body at={KID} box={KID_BODY} k={k}>
              <KidArm />
            </Body>
          )}
        </Animated.View>
      </Animated.View>

      {line ? <Bubble key={`${line.who}:${line.text}`} line={line} k={k} reduced={reduced} /> : null}
    </View>
  );
}

/**
 * The line on screen: each step's lines in turn, then quiet; a new step starts its own lines once
 * the one showing has had time to be read. The finds cut straight in.
 */
function useChat(topic: Topic, count: number): Line | null {
  const [at, setAt] = useState<{ topic: Topic; i: number } | null>(null);
  const since = useRef(0);
  const found = useMemo<Line>(() => ({ who: 'kid', text: `${count} ${count === 1 ? 'place' : 'places'}!` }), [count]);

  useEffect(() => {
    if (at?.topic === topic) return;
    const wait = topic === 'found' ? 0 : Math.max(0, since.current + MIN_LINE_MS - Date.now());
    const t = setTimeout(() => {
      since.current = Date.now();
      setAt({ topic, i: 0 });
    }, wait);
    return () => clearTimeout(t);
  }, [topic, at?.topic]);

  useEffect(() => {
    if (!at || at.topic === 'found' || at.i >= LINES[at.topic].length) return;
    const t = setTimeout(() => {
      since.current = Date.now();
      setAt({ topic: at.topic, i: at.i + 1 });
    }, LINE_MS);
    return () => clearTimeout(t);
  }, [at]);

  if (!at) return null;
  return at.topic === 'found' ? found : (LINES[at.topic][at.i] ?? null);
}

/** Who is mid-sentence: the speaker's mouth moves for about as long as the line takes to say. */
function useTalking(line: Line | null): Line | null {
  const [finished, setFinished] = useState<Line | null>(null);
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => setFinished(line), Math.min(1800, Math.max(700, line.text.length * 55)));
    return () => clearTimeout(t);
  }, [line]);
  return line && finished !== line ? line : null;
}

function Body({ at, box, k, children }: { at: { x: number; y: number }; box: { x: number; y: number; w: number; h: number }; k: number; children: React.ReactNode }) {
  return (
    <View style={{ position: 'absolute', left: (at.x + box.x) * k, top: (at.y + box.y) * k, width: box.w * k, height: box.h * k }}>
      {children}
    </View>
  );
}

function Head({
  layers,
  at,
  box,
  k,
  tilt,
  talking,
  who,
  reduced,
  cheer,
}: {
  layers: HeadLayers;
  at: { x: number; y: number };
  box: number;
  k: number;
  tilt: number;
  talking: boolean;
  who: 'amma' | 'kid';
  reduced: boolean;
  cheer: boolean;
}) {
  const size = box * k;
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: (at.x - box / 2) * k, top: (at.y - box / 2) * k, width: size, height: size, transform: [{ rotate: `${tilt}deg` }] },
        !reduced && motion.tilt,
      ]}
    >
      {layers.base}
      {/* A cheer's eyes are already shut with joy; otherwise they blink every few seconds. */}
      <Animated.View style={[StyleSheet.absoluteFill, !reduced && !cheer && (who === 'amma' ? motion.ammaOpen : motion.kidOpen)]}>{layers.eyes}</Animated.View>
      {cheer ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, styles.hidden, !reduced && (who === 'amma' ? motion.ammaShut : motion.kidShut)]}>{layers.shut}</Animated.View>
      )}
      {layers.mouth}
      {talking && !reduced && !cheer ? <Animated.View style={[StyleSheet.absoluteFill, motion.flap]}>{layers.open}</Animated.View> : null}
    </Animated.View>
  );
}

/** A speech bubble over whoever is talking, its tail pointing at them. */
function Bubble({ line, k, reduced }: { line: Line; k: number; reduced: boolean }) {
  const amma = line.who === 'amma';
  // From the bubble's near edge to the speaker's head.
  const reach = (amma ? AMMA.x - EDGE : W - EDGE - KID.x) * k;
  return (
    <Animated.View
      style={[
        styles.bubble,
        amma ? { left: EDGE * k, transformOrigin: 'left bottom' } : { right: EDGE * k, transformOrigin: 'right bottom' },
        { top: 8 * k, maxWidth: (W - EDGE * 2) * k, minWidth: reach + 22 },
        !reduced && motion.pop,
      ]}
    >
      <Text variant="label" color={BUBBLE_INK} numberOfLines={2} maxFontSizeMultiplier={1.3}>
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
  hidden: { opacity: 0 },
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
