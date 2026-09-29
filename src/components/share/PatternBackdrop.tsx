import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern as SvgPattern, Rect } from 'react-native-svg';

import { HEM, HEM_GOLD, shapeColour, type Look } from '@/lib/patterns';

/**
 * The trip's pattern, tone on tone, repeated over whatever is behind it: the story's own ground
 * colour (`ground`), or the sky on the share screen, eased out at the top there (`calm`) so the
 * heading stays clear. The same tile the saved story draws, so what's on screen is what gets posted.
 */
export function PatternBackdrop({ look, ground, calm }: { look: Look; ground?: boolean; calm?: { top: string; height: number } }) {
  const id = `pattern-${useId().replace(/:/g, '')}`;
  const { pattern } = look;
  return (
    <View style={[StyleSheet.absoluteFill, ground && { backgroundColor: look.ground }]} pointerEvents="none" aria-hidden>
      <Svg width="100%" height="100%">
        <Defs>
          <SvgPattern id={id} patternUnits="userSpaceOnUse" width={pattern.w} height={pattern.h}>
            {pattern.shapes.map((shape, i) =>
              shape.stroke ? (
                <Path
                  key={i}
                  d={shape.d}
                  fill="none"
                  stroke={shapeColour(shape)}
                  strokeWidth={shape.stroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <Path key={i} d={shape.d} fill={shapeColour(shape)} />
              ),
            )}
          </SvgPattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {ground ? (
        // Deeper at the edges, as printed cloth looks under light: the eye settles on the middle.
        <LinearGradient colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.32)']} locations={[0, 0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />
      ) : null}
      {ground && look.hem ? (
        <View style={[styles.hem, { height: HEM.height }]}>
          {HEM.bands.map((b) => (
            <View key={b.y} style={{ position: 'absolute', left: 0, right: 0, top: b.y, height: b.h, backgroundColor: HEM_GOLD }} />
          ))}
        </View>
      ) : null}
      {calm ? (
        <LinearGradient
          colors={[calm.top, withAlpha(calm.top, 0.75), withAlpha(calm.top, 0)]}
          locations={[0, 0.6, 1]}
          style={[styles.calm, { height: calm.height }]}
        />
      ) : null}
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
