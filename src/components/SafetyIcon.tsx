import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

// Albin's travel-safety icon set (references/animations/travel_safety_svg_icons.html):
// 24×24, 1.5 stroke, round caps and joins, no fills, one colour.
export type SafetyIconName =
  | 'strong-currents'
  | 'lifeguard'
  | 'well-lit-at-night'
  | 'solo-friendly'
  | 'women-friendly'
  | 'crowded-weekends'
  | 'patchy-network'
  | 'slippery-path';

type Props = { name: SafetyIconName; size?: number; color: string };

export function SafetyIcon({ name, size = 20, color }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </Svg>
  );
}

export const isSafetyIcon = (name: string): name is SafetyIconName => name in PATHS;

const PATHS: Record<SafetyIconName, ReactNode> = {
  'strong-currents': (
    <>
      <Path d="M16.5 2.5l4.5 8h-9z" />
      <Path d="M16.5 5.5v2" />
      <Path d="M16.5 9.5h.01" />
      <Path d="M2.5 13.5c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0" />
      <Path d="M2.5 17.5c2-1.5 4.5-1.5 6.5 0s4.5 1.5 6.5 0" />
      <Path d="M21.5 17.5h-4l1.5-1.5" />
    </>
  ),
  lifeguard: (
    <>
      <Circle cx={12} cy={11} r={8.5} />
      <Circle cx={12} cy={11} r={4} />
      <Path d="M12 2.5v4.5" />
      <Path d="M12 15v4.5" />
      <Path d="M3.5 11h4.5" />
      <Path d="M16 11h4.5" />
      <Path d="M3 21.5c1.8-1 3.8-1 5.5 0s3.7 1 5.5 0 3.7-1 5.5 0" />
    </>
  ),
  'well-lit-at-night': (
    <>
      <Path d="M4 21.5v-12c0-2.5 2-4.5 4.5-4.5h3" />
      <Path d="M9.5 5h4l1.5 3h-7z" />
      <Path d="M2.5 21.5h8" />
      <Path d="M8.5 12l-3.5 7.5" />
      <Path d="M11.5 12v7.5" />
      <Path d="M14.5 12l3.5 7.5" />
      <Path d="M18.5 2.5a3.5 3.5 0 0 1 3 3.5 3.5 3.5 0 0 1-4.2 3.4 3.5 3.5 0 0 0 1.2-6.9z" />
    </>
  ),
  'solo-friendly': (
    <>
      <Circle cx={8} cy={5} r={2} />
      <Rect x={3.5} y={8} width={2} height={4} rx={0.8} />
      <Path d="M8 7v6.5" />
      <Path d="M8 9l-2.5 2.5" />
      <Path d="M8 9l2 2" />
      <Path d="M8 13.5l-3 7.5" />
      <Path d="M8 13.5l3.5 7.5" />
      <Path d="M2.5 21.5h10" />
      <Circle cx={18} cy={7.5} r={4.5} />
      <Path d="M18 4.5v6" />
      <Path d="M15 7.5h6" />
    </>
  ),
  'women-friendly': (
    <>
      <Path d="M12 2.5l7.5 3.2v5.8c0 5.2-3.8 9.5-7.5 11-3.7-1.5-7.5-5.8-7.5-11v-5.8z" />
      <Circle cx={12} cy={9} r={2.8} />
      <Path d="M12 11.8v5.2" />
      <Path d="M9.5 14.5h5" />
    </>
  ),
  'crowded-weekends': (
    <>
      <Rect x={13.5} y={2.5} width={8} height={8} rx={1.8} />
      <Path d="M16 1.5v2" />
      <Path d="M19 1.5v2" />
      <Path d="M13.5 5.5h8" />
      <Circle cx={8} cy={10} r={2} />
      <Path d="M4.5 21.5c0-2.8 1.8-4.5 3.5-4.5s3.5 1.7 3.5 4.5" />
      <Circle cx={3.5} cy={11.5} r={1.5} />
      <Path d="M1 21.5c0-2 1.1-3.2 2.5-3.2" />
      <Circle cx={13} cy={12} r={1.5} />
      <Path d="M14.5 18.5c1.2 0 2.2 1 2.2 3" />
      <G>
        <Circle cx={11} cy={7} r={1.5} />
        <Path d="M9 12.5c.6-.3 1.2-.5 2-.5 1.2 0 2.2.6 2.5 1.5" />
      </G>
    </>
  ),
  'patchy-network': (
    <>
      <Path d="M3.5 21.5l3.5-14 3.5 14" />
      <Path d="M4.8 16.5h4.4" />
      <Path d="M5.5 12.5h3" />
      <Circle cx={7} cy={5} r={1.5} />
      <Path d="M11 5a5.5 5.5 0 0 1 0 7.5" />
      <Path d="M14 3a9 9 0 0 1 0 11.5" strokeDasharray="2.5 2" />
      <Path d="M17 1a12.5 12.5 0 0 1 0 15.5" strokeDasharray="1.5 3" />
      <Path d="M17 17.5l4.5 4.5" />
      <Path d="M21.5 17.5l-4.5 4.5" />
    </>
  ),
  'slippery-path': (
    <>
      <Path d="M2.5 19.5c4-1 6.5-4 10-4s5.5 2 9 1" />
      <Circle cx={12} cy={5} r={2} />
      <Path d="M11 7l-3.5 4.5" />
      <Path d="M9.5 8.5l-4-2" />
      <Path d="M10 9.5l3.5-2" />
      <Path d="M7.5 11.5l-4.5 2" />
      <Path d="M7.5 11.5l5 1.5" />
      <Path d="M13.5 17.5c1.8-.5 3.8-.5 5.5 0" />
      <Path d="M18.5 7.5l1.5 2.5" />
    </>
  ),
};
