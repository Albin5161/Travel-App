import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern as SvgPattern, Rect } from 'react-native-svg';

import { PATTERN_ALPHA, PATTERN_GOLD, type Pattern } from '@/lib/patterns';

/**
 * The trip's state pattern, repeated over the sky behind it, and eased out at the top so a heading
 * there stays clear. The same tile the saved story draws, so what's on screen is what gets posted.
 */
export function PatternBackdrop({ pattern, top, calm = 190 }: { pattern: Pattern; top: string; calm?: number }) {
  const id = `pattern-${useId().replace(/:/g, '')}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Svg width="100%" height={pattern.hem ? pattern.h : '100%'} style={pattern.hem ? styles.hem : undefined}>
        <Defs>
          <SvgPattern id={id} patternUnits="userSpaceOnUse" width={pattern.w} height={pattern.h}>
            {pattern.shapes.map((shape, i) => {
              const colour = shape.gold ? PATTERN_GOLD : '#FFFFFF';
              const alpha = Math.min(1, PATTERN_ALPHA * (shape.alpha ?? 1));
              return shape.stroke ? (
                <Path
                  key={i}
                  d={shape.d}
                  fill="none"
                  stroke={colour}
                  strokeOpacity={alpha}
                  strokeWidth={shape.stroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <Path key={i} d={shape.d} fill={colour} fillOpacity={alpha} />
              );
            })}
          </SvgPattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {pattern.hem ? null : <LinearGradient colors={[top, withAlpha(top, 0.75), withAlpha(top, 0)]} locations={[0, 0.6, 1]} style={[styles.calm, { height: calm }]} />}
    </View>
  );
}

function withAlpha(hex: string, alpha: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const styles = StyleSheet.create({
  calm: { position: 'absolute', top: 0, left: 0, right: 0 },
  hem: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
