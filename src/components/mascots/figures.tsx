import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme/tokens';

// Amma and the child, drawn as flat shapes (the sketch Albin approved on 29 Sep 2026): a young
// mum in a kasavu saree, and one child for everyone. Each head is split into layers (the face,
// open eyes, shut eyes, a closed mouth, an open one) so blinking and talking are only a change of
// opacity on the layer above: cheap on a phone, and the same on the web.

const INK = {
  kasavu: '#F3E9D2',
  kasavuShade: '#E2D5B8',
  gold: '#D4A24C',
  goldDeep: '#B9852F',
  skin: '#9A6243',
  skinShade: '#7E4C33',
  skinKid: '#A8714F',
  skinKidShade: '#8A5A3D',
  hair: '#231B1E',
  ember: colors.ember,
  emberDeep: '#C45E28',
  face: '#1A1214',
  tongue: '#D9695A',
  blush: 'rgba(226,118,60,0.38)',
  white: '#FFFFFF',
};

export type Mood = 'idle' | 'wait' | 'cheer';

/** One layer of a head: a square box around its centre, filling whatever holds it. */
function Layer({ box, children }: { box: number; children: React.ReactNode }) {
  const h = box / 2;
  return (
    <Svg width="100%" height="100%" viewBox={`${-h} ${-h} ${box} ${box}`} style={StyleSheet.absoluteFill}>
      {children}
    </Svg>
  );
}

// Faces are drawn for a head of radius 34 and scaled by k for smaller ones.
function Brows({ k, mood }: { k: number; mood: Mood }) {
  const y = mood === 'cheer' ? -12 * k : mood === 'wait' ? -9 * k : -10 * k;
  const worry = mood === 'wait' ? 2 * k : 0;
  const ex = 12 * k;
  const d = (x: number, left: boolean) =>
    left
      ? `M ${x - 5 * k} ${y + worry} Q ${x} ${y - 3 * k} ${x + 5 * k} ${y}`
      : `M ${x - 5 * k} ${y} Q ${x} ${y - 3 * k} ${x + 5 * k} ${y + worry}`;
  return (
    <>
      <Path d={d(-ex, true)} stroke={INK.face} strokeWidth={2.2 * k} fill="none" strokeLinecap="round" />
      <Path d={d(ex, false)} stroke={INK.face} strokeWidth={2.2 * k} fill="none" strokeLinecap="round" />
    </>
  );
}

function Cheeks({ k, shade }: { k: number; shade: string }) {
  return (
    <>
      <Circle cx={-19 * k} cy={12 * k} r={5.5 * k} fill={INK.blush} />
      <Circle cx={19 * k} cy={12 * k} r={5.5 * k} fill={INK.blush} />
      <Path d={`M ${-2 * k} ${9 * k} Q 0 ${11 * k} ${2 * k} ${9 * k}`} stroke={shade} strokeWidth={2 * k} fill="none" strokeLinecap="round" />
    </>
  );
}

/** Eyes open, glancing towards the phone; when cheering, happy upturned arcs instead. */
function Eyes({ k, look, mood }: { k: number; look: number; mood: Mood }) {
  const ex = 12 * k;
  if (mood === 'cheer') {
    return (
      <>
        {[-ex, ex].map((x) => (
          <Path key={x} d={`M ${x - 4.5 * k} ${3 * k} Q ${x} ${-3 * k} ${x + 4.5 * k} ${3 * k}`} stroke={INK.face} strokeWidth={2.4 * k} fill="none" strokeLinecap="round" />
        ))}
      </>
    );
  }
  const up = mood === 'wait' ? -1.5 * k : 0;
  return (
    <>
      {[-ex, ex].map((x) => (
        <G key={x}>
          <Ellipse cx={x + look} cy={2 * k + up} rx={3.4 * k} ry={4.4 * k} fill={INK.face} />
          <Circle cx={x + look + 1.2 * k} cy={0.4 * k + up} r={1.2 * k} fill={INK.white} />
        </G>
      ))}
    </>
  );
}

function EyesShut({ k }: { k: number }) {
  const ex = 12 * k;
  return (
    <>
      {[-ex, ex].map((x) => (
        <Path key={x} d={`M ${x - 4 * k} ${2 * k} Q ${x} ${5 * k} ${x + 4 * k} ${2 * k}`} stroke={INK.face} strokeWidth={2.2 * k} fill="none" strokeLinecap="round" />
      ))}
    </>
  );
}

function Mouth({ k, mood }: { k: number; mood: Mood }) {
  if (mood === 'cheer') {
    return (
      <>
        <Path d={`M ${-9 * k} ${15 * k} Q 0 ${15 * k} ${9 * k} ${15 * k} Q ${8 * k} ${28 * k} 0 ${28 * k} Q ${-8 * k} ${28 * k} ${-9 * k} ${15 * k} Z`} fill={INK.face} />
        <Path d={`M ${-6 * k} ${24 * k} Q 0 ${20 * k} ${6 * k} ${24 * k} Q 0 ${28 * k} ${-6 * k} ${24 * k} Z`} fill={INK.tongue} />
        <Rect x={-7 * k} y={15.5 * k} width={14 * k} height={2.6 * k} rx={1 * k} fill={INK.white} />
      </>
    );
  }
  if (mood === 'wait') return <Ellipse cx={2 * k} cy={19 * k} rx={3 * k} ry={2.6 * k} fill={INK.face} />;
  return <Path d={`M ${-7 * k} ${17 * k} Q 0 ${23 * k} ${7 * k} ${17 * k}`} stroke={INK.face} strokeWidth={2.4 * k} fill="none" strokeLinecap="round" />;
}

/** The mouth mid-word, laid over the closed one while a line is said. */
function MouthOpen({ k }: { k: number }) {
  return (
    <>
      <Path d={`M ${-6 * k} ${16 * k} Q 0 ${15 * k} ${6 * k} ${16 * k} Q ${5 * k} ${25 * k} 0 ${25 * k} Q ${-5 * k} ${25 * k} ${-6 * k} ${16 * k} Z`} fill={INK.face} />
      <Ellipse cx={0} cy={22.5 * k} rx={3 * k} ry={1.8 * k} fill={INK.tongue} />
    </>
  );
}

/** The layers of one head, for the scene to stack and animate. */
export type HeadLayers = { base: React.ReactNode; eyes: React.ReactNode; shut: React.ReactNode; mouth: React.ReactNode; open: React.ReactNode };

export const AMMA_HEAD_BOX = 120;
export const KID_HEAD_BOX = 90;

/** Amma's head: hair in a plain bun, gold jhumkas, an ember bindi. Radius 34. */
export function ammaHead(mood: Mood, look: number): HeadLayers {
  const box = AMMA_HEAD_BOX;
  return {
    base: (
      <Layer box={box}>
        <Circle cx={-24} cy={-26} r={19} fill={INK.hair} />
        <Circle cx={-33} cy={4} r={6.5} fill={INK.skinShade} />
        <Circle cx={33} cy={4} r={6.5} fill={INK.skinShade} />
        <Path d="M -37 13 h 8 l -1 5 h -6 z" fill={INK.gold} />
        <Path d="M 29 13 h 8 l -1 5 h -6 z" fill={INK.gold} />
        <Circle cx={0} cy={0} r={34} fill={INK.skin} />
        <Path d="M -1 -34.5 C -20 -35, -36 -22, -34.5 6 C -31 -8, -20 -20, -1 -24 Z" fill={INK.hair} />
        <Path d="M 1 -34.5 C 20 -35, 36 -22, 34.5 6 C 31 -8, 20 -20, 1 -24 Z" fill={INK.hair} />
        <Cheeks k={1} shade={INK.skinShade} />
        <Brows k={1} mood={mood} />
        <Circle cx={0} cy={-15} r={2.8} fill={INK.ember} />
      </Layer>
    ),
    eyes: <Layer box={box}><Eyes k={1} look={look} mood={mood} /></Layer>,
    shut: <Layer box={box}><EyesShut k={1} /></Layer>,
    mouth: <Layer box={box}><Mouth k={1} mood={mood} /></Layer>,
    open: <Layer box={box}><MouthOpen k={1} /></Layer>,
  };
}

/** The child's head: a soft mop of hair over the ears. Radius 27. */
export function kidHead(mood: Mood, look: number): HeadLayers {
  const box = KID_HEAD_BOX;
  const k = 27 / 34;
  return {
    base: (
      <Layer box={box}>
        <Circle cx={-26} cy={5} r={5.5} fill={INK.skinKidShade} />
        <Circle cx={26} cy={5} r={5.5} fill={INK.skinKidShade} />
        <Circle cx={0} cy={0} r={27} fill={INK.skinKid} />
        <Path d="M -30 8 C -35 -42, 35 -42, 30 8 C 28 -2, 23 -8, 15 -9 C 10 -14, 2 -13, -3 -9 C -9 -14, -19 -12, -23 -6 C -27 -3, -29 2, -30 8 Z" fill={INK.hair} />
        <Cheeks k={k} shade={INK.skinKidShade} />
        <Brows k={k} mood={mood} />
      </Layer>
    ),
    eyes: <Layer box={box}><Eyes k={k} look={look} mood={mood} /></Layer>,
    shut: <Layer box={box}><EyesShut k={k} /></Layer>,
    mouth: <Layer box={box}><Mouth k={k} mood={mood} /></Layer>,
    open: <Layer box={box}><MouthOpen k={k} /></Layer>,
  };
}

// Bodies, in the head's coordinates (its centre at 0,0), cropped by the scene's bottom edge.
export const AMMA_BODY = { x: -70, y: 20, w: 140, h: 130 };
export const KID_BODY = { x: -55, y: 15, w: 110, h: 120 };

/** Amma from the neck down: the saree, its pallu over her shoulder, and the arm holding the phone. */
export function AmmaBody() {
  const b = AMMA_BODY;
  return (
    <Svg width="100%" height="100%" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={StyleSheet.absoluteFill}>
      <Path d="M -58 150 C -60 86, -40 52, 0 49 C 40 52, 60 86, 58 150 Z" fill={INK.kasavu} />
      <Path d="M -16 50 Q 0 70 16 50 Z" fill={INK.gold} />
      <Path d="M 14 50 C 34 52, 52 70, 56 96 L 20 150 L -14 150 Z" fill={INK.kasavuShade} />
      <Path d="M -14 150 L 22 64" stroke={INK.gold} strokeWidth={7} strokeLinecap="round" />
      <Path d="M -4 150 L 28 76" stroke={INK.goldDeep} strokeWidth={2} strokeLinecap="round" />
      <Rect x={-9} y={24} width={18} height={30} rx={8} fill={INK.skinShade} />
      <Path d="M 30 72 Q 40 92 56 80" stroke={INK.skin} strokeWidth={14} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** The child from the neck down: an ember t-shirt with one kasavu stripe, an arm up to the phone. */
export function KidBody() {
  const b = KID_BODY;
  const shirt = 'M -42 130 C -42 70, -26 40, 0 38 C 26 40, 42 70, 42 130 Z';
  // Ids are page-wide on the web: each drawing gets its own, as PatternBackdrop does.
  const clip = `kidShirt${useId().replace(/:/g, '')}`;
  return (
    <Svg width="100%" height="100%" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <ClipPath id={clip}>
          <Path d={shirt} />
        </ClipPath>
      </Defs>
      <Path d={shirt} fill={INK.ember} />
      <Path d="M -10 39 Q 0 50 10 39" stroke={INK.emberDeep} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M -50 88 L 50 88" stroke={INK.kasavu} strokeWidth={5} clipPath={`url(#${clip})`} />
      <Rect x={-7} y={18} width={14} height={24} rx={6} fill={INK.skinKidShade} />
    </Svg>
  );
}

/**
 * The child's arm up to the phone, finger on the screen. Drawn over the phone, in the child's
 * own layer, so it moves with them.
 */
export function KidArm() {
  const b = KID_BODY;
  return (
    <Svg width="100%" height="100%" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={StyleSheet.absoluteFill}>
      <Path d="M -24 64 Q -44 56 -40 32" stroke={INK.skinKid} strokeWidth={11} fill="none" strokeLinecap="round" />
      <Path d="M -44 30 L -50 27" stroke={INK.skinKid} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={-41} cy={31} r={5.5} fill={INK.skinKid} />
    </Svg>
  );
}

/** The phone they share, with Amma's hand under it. */
export function Phone({ x, y }: { x: number; y: number }) {
  const screen = `mascotScreen${useId().replace(/:/g, '')}`;
  return (
    <G>
      <G transform={`translate(${x} ${y}) rotate(-8)`}>
        <Defs>
          <LinearGradient id={screen} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFB98F" />
            <Stop offset="1" stopColor="#C85C7A" />
          </LinearGradient>
        </Defs>
        <Rect x={-15} y={-26} width={30} height={52} rx={6} fill={colors.night} />
        <Rect x={-12} y={-22} width={24} height={44} rx={3.5} fill={`url(#${screen})`} />
        <Path d="M -3 -6 L 6 0 L -3 6 Z" fill="rgba(255,255,255,0.9)" />
      </G>
      <Ellipse cx={x - 12} cy={y + 22} rx={9} ry={7.5} fill={INK.skin} />
    </G>
  );
}
