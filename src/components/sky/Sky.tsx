import { memo, useId } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { SkyPhase } from '@/lib/sun';
import { SKY } from '@/theme/sky';

type Props = {
  phase: SkyPhase;
  /** Darkens the lower part of the sky, 0 to 1, where a screen sets its reading text. */
  shade?: number;
};

// Cloud banks as clusters of soft puffs, placed as fractions of the screen. Each puff is a radial
// fade from white to nothing, so overlapping ones merge into one soft shape with no edge.
const BANKS: { x: number; y: number; w: number; h: number; o: number }[][] = [
  [
    { x: 0.05, y: 0.16, w: 0.55, h: 0.09, o: 0.9 },
    { x: 0.28, y: 0.13, w: 0.45, h: 0.1, o: 1 },
    { x: 0.48, y: 0.17, w: 0.5, h: 0.08, o: 0.7 },
  ],
  [
    { x: 0.7, y: 0.36, w: 0.6, h: 0.08, o: 0.8 },
    { x: 0.92, y: 0.33, w: 0.45, h: 0.09, o: 0.9 },
  ],
  [
    { x: -0.05, y: 0.55, w: 0.5, h: 0.07, o: 0.6 },
    { x: 0.2, y: 0.58, w: 0.45, h: 0.06, o: 0.5 },
  ],
  [
    { x: 0.6, y: 0.8, w: 0.7, h: 0.1, o: 0.55 },
    { x: 0.95, y: 0.84, w: 0.5, h: 0.08, o: 0.5 },
  ],
];

// Stars from a fixed seed, so the same sky comes back every time rather than a new one per render.
const STARS = (() => {
  let s = 7;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: 90 }, () => {
    const y = rand() ** 1.6 * 0.7;
    return { x: rand(), y, r: 0.5 + rand() * 0.9, o: (0.35 + rand() * 0.65) * (1 - y) };
  });
})();

/**
 * A still sky filling its parent: a three-stop gradient, the light source as a wide soft glow,
 * a few cloud banks and, at night, stars. Drawn as one picture with no motion, so it costs a single
 * paint and nothing while the screen is open.
 */
export const Sky = memo(function Sky({ phase, shade = 0 }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const look = SKY[phase];
  const { glow } = look;
  const glowR = glow.r * Math.max(W, H);
  // Gradient ids are global on the web page; two skies mounted at once (a screen under a screen)
  // would otherwise paint with each other's colours.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={W} height={H} style={styles.fill} pointerEvents="none">
      <Defs>
        <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={look.stops[0]} />
          <Stop offset="0.55" stopColor={look.stops[1]} />
          <Stop offset="1" stopColor={look.stops[2]} />
        </LinearGradient>
        <RadialGradient
          id={`glow${id}`}
          cx={glow.x * W}
          cy={glow.y * H}
          rx={glowR}
          ry={glowR}
          fx={glow.x * W}
          fy={glow.y * H}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
          <Stop offset="0.45" stopColor={glow.color} stopOpacity={glow.opacity * 0.35} />
          <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`puff${id}`} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.45} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`shade${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#040A1E" stopOpacity={0} />
          <Stop offset="1" stopColor="#040A1E" stopOpacity={shade} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill={`url(#sky${id})`} />
      {look.stars > 0
        ? STARS.map((s, i) => (
            <Circle key={i} cx={s.x * W} cy={s.y * H} r={s.r} fill="#FFFFFF" opacity={s.o * look.stars} />
          ))
        : null}
      <Rect x={0} y={0} width={W} height={H} fill={`url(#glow${id})`} />
      {look.clouds > 0
        ? BANKS.flat().map((p, i) => (
            <Ellipse
              key={i}
              cx={p.x * W}
              cy={p.y * H}
              rx={(p.w * W) / 2}
              ry={(p.h * H) / 2}
              fill={`url(#puff${id})`}
              opacity={p.o * look.clouds}
            />
          ))
        : null}
      {shade > 0 ? <Rect x={0} y={H * 0.4} width={W} height={H * 0.6} fill={`url(#shade${id})`} /> : null}
    </Svg>
  );
});

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 },
});
